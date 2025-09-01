import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import OpenAI from "openai"
import {
  ChatCompletion,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings, LLMID } from "@/types"
import { MODEL_PROMPTS } from "@/lib/build-prompt"
import { OPENAI_LLM_LIST } from "@/lib/models/llm/openai-llm-list"
import { ServerRuntime } from "next"
// ✨ این خط را حذف می‌کنیم تا از Node.js Runtime استفاده شود که با سوپابیس سازگارتر است
export const runtime: ServerRuntime = "edge"

type ChatCompletionUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

type ExtendedChatSettings = ChatSettings & {
  maxTokens?: number
}

const pricingMap = new Map(
  OPENAI_LLM_LIST.map(llm => [llm.modelId, llm.pricing])
)
const PROFIT_MARGIN = 1.4 // 40% سود

// این تابع هزینه را به دلار محاسبه می‌کند
function calculateUserCostUSD(
  modelId: LLMID,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  const pricing = pricingMap.get(modelId)
  if (!pricing?.inputCost || !pricing.outputCost) {
    return 0
  }
  const promptCost = (usage.prompt_tokens / 1_000_000) * pricing.inputCost
  const completionCost =
    (usage.completion_tokens / 1_000_000) * pricing.outputCost
  const totalOpenAICost = promptCost + completionCost
  return totalOpenAICost * PROFIT_MARGIN
}

export async function POST(request: Request) {
  const { chatSettings, messages } = await request.json()

  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse("Unauthorized", { status: 401 })
    const userId = user.id

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()

    if (walletError && walletError.code === "PGRST116") {
      const { data: newWallet } = await supabase
        .from("wallets")
        .insert({ user_id: userId, balance: 0 })
        .select("balance")
        .single()
      if (!newWallet || newWallet.balance <= 0) {
        return NextResponse.json(
          { message: "موجودی شما کافی نیست. لطفاً حساب خود را شارژ کنید." },
          { status: 402 }
        )
      }
    } else if (walletError) {
      throw walletError
    }

    if (!wallet) return new NextResponse("Wallet not found", { status: 404 })

    if (wallet.balance <= 0) {
      return NextResponse.json(
        { message: "موجودی شما کافی نیست. لطفاً حساب خود را شارژ کنید." },
        { status: 402 }
      )
    }

    const profile = await getServerProfile()
    checkApiKey(profile.openai_api_key, "OpenAI")
    const openai = new OpenAI({ apiKey: profile.openai_api_key || "" })
    const selectedModel = chatSettings.model as LLMID

    // ✨ ۱. پیاده‌سازی MODEL_PROMPTS
    // بررسی می‌کنیم آیا پیام سیستمی از قبل وجود دارد یا نه
    const hasSystemMessage = messages.some((msg: any) => msg.role === "system")
    let finalMessages = [...messages]

    if (!hasSystemMessage && MODEL_PROMPTS[selectedModel]) {
      // اگر وجود نداشت، پرامپت سفارشی مدل را از ماژول اضافه می‌کنیم
      finalMessages.unshift({
        role: "system",
        content: MODEL_PROMPTS[selectedModel]
      })
    }

    const useStream = chatSettings.stream !== false

    if (useStream) {
      const payload: ChatCompletionCreateParamsStreaming = {
        model: selectedModel,
        messages: finalMessages, // ✨ استفاده از پیام‌های نهایی
        stream: true,
        temperature: chatSettings.temperature,
        max_tokens: chatSettings.max_tokens,
        stream_options: { include_usage: true }
      }

      const stream = await openai.chat.completions.create(payload)
      const encoder = new TextEncoder()

      const readableStream = new ReadableStream({
        async start(controller) {
          let usage: ChatCompletionUsage | undefined
          try {
            for await (const chunk of stream) {
              if (chunk.usage) usage = chunk.usage
              const delta = chunk.choices[0]?.delta?.content || ""
              if (delta) controller.enqueue(encoder.encode(delta))
            }

            if (usage) {
              const userCostUSD = calculateUserCostUSD(selectedModel, usage)
              console.log(
                `Deducting cost: $${userCostUSD.toFixed(6)} USD for user ${userId}`
              )

              // ✨ ۲. کسر هزینه به دلار از دیتابیس
              const { error: rpcError } = await supabase.rpc(
                "deduct_credits_and_log_usage",
                {
                  p_user_id: userId,
                  p_model_name: selectedModel,
                  p_prompt_tokens: usage.prompt_tokens,
                  p_completion_tokens: usage.completion_tokens,
                  p_cost: userCostUSD // ارسال هزینه به دلار
                }
              )
              if (rpcError)
                console.error("!!! Supabase RPC Error (Stream) !!!:", rpcError)
            }
          } catch (error) {
            console.error("Error during stream billing:", error)
          } finally {
            controller.close()
          }
        }
      })
      return new Response(readableStream, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8" }
      })
    } else {
      // حالت غیر استریم
      const payload: ChatCompletionCreateParams = {
        model: selectedModel,
        messages: finalMessages, // ✨ استفاده از پیام‌های نهایی
        stream: false,
        temperature: chatSettings.temperature,
        max_tokens: chatSettings.max_tokens
      }

      // قبل از ارسال، هزینه احتمالی را تخمین زده و موجودی را چک می‌کنیم (اختیاری اما بهتر)

      const response = await openai.chat.completions.create(payload)
      const content = response.choices[0].message.content ?? ""
      const usage = response.usage

      if (usage) {
        const userCostUSD = calculateUserCostUSD(selectedModel, usage)
        console.log(
          `Deducting cost: $${userCostUSD.toFixed(6)} USD for user ${userId}`
        )

        if (wallet.balance < userCostUSD) {
          // این حالت کم پیش می‌آید اما برای اطمینان چک می‌شود
          return NextResponse.json(
            { message: "موجودی شما پس از این درخواست کافی نخواهد بود." },
            { status: 402 }
          )
        }

        // ✨ ۲. کسر هزینه به دلار از دیتابیس
        const { error: rpcError } = await supabase.rpc(
          "deduct_credits_and_log_usage",
          {
            p_user_id: userId,
            p_model_name: selectedModel,
            p_prompt_tokens: usage.prompt_tokens,
            p_completion_tokens: usage.completion_tokens,
            p_cost: userCostUSD
          }
        )
        if (rpcError)
          console.error("!!! Supabase RPC Error (Non-Stream) !!!:", rpcError)
      }

      return new Response(content, {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      })
    }
  } catch (error: any) {
    console.error("!!! FULL BACKEND ERROR CATCH !!!:", error)
    const errorMessage = error.message || "یک خطای غیرمنتظره رخ داد"
    const status = error.status || 500
    return NextResponse.json({ message: errorMessage }, { status })
  }
}
