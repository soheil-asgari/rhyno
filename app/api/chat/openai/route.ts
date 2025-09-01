import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings, LLMID } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import {
  ChatCompletion,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions"
import { NextResponse } from "next/server"
import { MODEL_PROMPTS } from "@/lib/build-prompt"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { OPENAI_LLM_LIST } from "@/lib/models/llm/openai-llm-list"

export const runtime: ServerRuntime = "edge"

type ChatCompletionUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

type ExtendedChatSettings = ChatSettings & {
  maxTokens?: number
  max_tokens?: number
}

const pricingMap = new Map(
  OPENAI_LLM_LIST.map(llm => [llm.modelId, llm.pricing])
)
const PROFIT_MARGIN = 1.4

const MODELS_NEED_MAX_COMPLETION = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-5",
  "gpt-5-mini"
])
const MODELS_WITH_OPENAI_WEB_SEARCH = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-5",
  "gpt-5-mini"
])
const MODELS_THAT_SHOULD_NOT_STREAM = new Set(["gpt-5", "gpt-5-mini"])
const MODELS_WITH_AUTO_SEARCH = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-5",
  "gpt-5-mini"
])

function pickMaxTokens(cs: ExtendedChatSettings): number {
  return Math.min(cs.maxTokens ?? cs.max_tokens ?? 10000, 12000)
}

// این تابع هزینه را به دلار محاسبه می‌کند
function calculateUserCostUSD(
  modelId: LLMID,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  const pricing = pricingMap.get(modelId)
  if (!pricing?.inputCost || !pricing.outputCost) {
    console.warn(
      `Token pricing not found for model: ${modelId}. Billing skipped.`
    )
    return 0
  }

  const promptCost = (usage.prompt_tokens / 1_000_000) * pricing.inputCost
  const completionCost =
    (usage.completion_tokens / 1_000_000) * pricing.outputCost
  const totalOpenAICost = promptCost + completionCost

  return totalOpenAICost * PROFIT_MARGIN
}

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages, enableWebSearch } = json

  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    // ✨ ۱. استفاده از متد امن‌تر getUser
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return new NextResponse("Unauthorized: No user found.", { status: 401 })
    }
    const userId = user.id

    let { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()

    if (walletError && walletError.code === "PGRST116") {
      const { data: newWallet, error: createError } = await supabase
        .from("wallets")
        .insert({ user_id: userId, balance: 0 })
        .select("balance")
        .single()
      if (createError) throw createError
      wallet = newWallet
    } else if (walletError) {
      throw walletError
    }

    if (!wallet) {
      return new NextResponse("User wallet could not be confirmed.", {
        status: 404
      })
    }

    // ✨ ۲. دریافت نرخ تبدیل دلار به ریال از دیتابیس
    // این خط را جایگزین کنید
    const exchangeRate = 1030000 // قیمت دلخواه خود را اینجا وارد کنید

    // بررسی اولیه موجودی (یک حداقل هزینه را در نظر می‌گیریم)
    if (wallet.balance <= 0) {
      return new NextResponse(
        JSON.stringify({
          message: "موجودی شما کافی نیست. لطفاً حساب خود را شارژ کنید."
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      )
    }

    const hasImage = messages.some(
      (message: any) =>
        Array.isArray(message.content) &&
        message.content.some((part: any) => part.type === "image_url")
    )
    const profile = await getServerProfile()
    checkApiKey(profile.openai_api_key, "OpenAI")
    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })
    const selectedModel = (chatSettings.model || "gpt-4o-mini") as LLMID

    if (selectedModel === "dall-e-3") {
      // منطق DALL-E باید به فایل خودش منتقل شود
      return NextResponse.json(
        { message: "DALL-E 3 requests should be sent to /api/dalle/route.ts" },
        { status: 400 }
      )
    }

    // ... سایر منطق‌ها مثل Realtime ...

    const cs = chatSettings as ExtendedChatSettings
    const maxTokens = pickMaxTokens(cs)
    let enableSearch: boolean = false // مقداردهی اولیه
    if (hasImage) {
      enableSearch = false
    } else if (typeof enableWebSearch === "boolean") {
      enableSearch = enableWebSearch
    } else if (MODELS_WITH_AUTO_SEARCH.has(selectedModel)) {
      enableSearch = true
    }
    const temp = typeof cs.temperature === "number" ? cs.temperature : 1
    const useStream = !MODELS_THAT_SHOULD_NOT_STREAM.has(selectedModel)

    if (useStream) {
      const payload: ChatCompletionCreateParamsStreaming = {
        model: selectedModel,
        messages,
        stream: true,
        temperature: temp,
        max_tokens: maxTokens,
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
              const userCostIRR = userCostUSD * exchangeRate // ✨ ۳. تبدیل هزینه به ریال

              if (userCostIRR > 0) {
                const { error: rpcError } = await supabase.rpc(
                  "deduct_credits_and_log_usage",
                  {
                    p_user_id: userId,
                    p_model_name: selectedModel,
                    p_prompt_tokens: usage.prompt_tokens,
                    p_completion_tokens: usage.completion_tokens,
                    p_cost: userCostIRR // ✨ ارسال هزینه به ریال
                  }
                )
                if (rpcError)
                  console.error(
                    "!!! Supabase RPC Error (Stream) !!!:",
                    rpcError
                  )
              }
            }
          } catch (error) {
            console.error("Error during stream billing:", error)
          } finally {
            controller.close()
          }
        }
      })
      // ✨ ۴. اصلاح هدر برای سازگاری بهتر
      return new Response(readableStream, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8" }
      })
    } else {
      // حالت غیر استریم
      const payload: ChatCompletionCreateParams = {
        model: selectedModel,
        messages,
        stream: false,
        temperature: temp,
        max_tokens: maxTokens
      }

      const response = await openai.chat.completions.create(payload)
      const content = response.choices[0].message.content ?? ""
      const usage = response.usage

      if (usage) {
        const userCostUSD = calculateUserCostUSD(selectedModel, usage)
        const userCostIRR = userCostUSD * exchangeRate // ✨ ۳. تبدیل هزینه به ریال

        if (userCostIRR > 0) {
          const { error: rpcError } = await supabase.rpc(
            "deduct_credits_and_log_usage",
            {
              p_user_id: userId,
              p_model_name: selectedModel,
              p_prompt_tokens: usage.prompt_tokens,
              p_completion_tokens: usage.completion_tokens,
              p_cost: userCostIRR // ✨ ارسال هزینه به ریال
            }
          )
          if (rpcError)
            console.error("!!! Supabase RPC Error (Non-Stream) !!!:", rpcError)
        }
      }

      return new Response(content, {
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      })
    }
  } catch (error: any) {
    console.error("!!! FULL BACKEND ERROR CATCH !!!:", error)
    const errorMessage = error.message || "یک خطای غیرمنتظره رخ داد"
    const status = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: status,
      headers: { "Content-Type": "application/json" }
    })
  }
}
