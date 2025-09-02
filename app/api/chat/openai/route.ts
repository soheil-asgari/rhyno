import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings, LLMID } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import type {
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions"
import { NextResponse } from "next/server"
import { MODEL_PROMPTS } from "@/lib/build-prompt"

// ✨ ایمپورت‌های جدید برای پرداخت و احراز هویت
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { OPENAI_LLM_LIST } from "@/lib/models/llm/openai-llm-list"

// از Node.js runtime استفاده می‌کنیم
export const runtime: ServerRuntime = "nodejs"

type ChatCompletionUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

type ExtendedChatSettings = ChatSettings & {
  maxTokens?: number
  max_tokens?: number
}

// ✨ ثابت‌ها و تابع محاسبه هزینه
const pricingMap = new Map(
  OPENAI_LLM_LIST.map(llm => [llm.modelId, llm.pricing])
)
const PROFIT_MARGIN = 1.4

function calculateUserCostUSD(
  modelId: LLMID,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  const pricing = pricingMap.get(modelId)
  if (!pricing?.inputCost || !pricing.outputCost) return 0
  const promptCost = (usage.prompt_tokens / 1_000_000) * pricing.inputCost
  const completionCost =
    (usage.completion_tokens / 1_000_000) * pricing.outputCost
  return (promptCost + completionCost) * PROFIT_MARGIN
}

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

export async function POST(request: Request) {
  console.log("🔥🔥🔥 درخواست به API دریافت شد! شروع پردازش... 🔥🔥🔥")
  try {
    const { chatSettings, messages, enableWebSearch } = await request.json()

    // ✨ شروع بخش پرداخت و احراز هویت
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
      return NextResponse.json(
        { message: "موجودی شما کافی نیست." },
        { status: 402 }
      )
    } else if (walletError) {
      throw walletError
    }

    if (!wallet || wallet.balance <= 0) {
      return NextResponse.json(
        { message: "موجودی شما کافی نیست." },
        { status: 402 }
      )
    }
    // ✨ پایان بخش پرداخت و احراز هویت

    const profile = await getServerProfile()
    checkApiKey(profile.openai_api_key, "OpenAI")
    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const selectedModel = (chatSettings.model || "gpt-4o-mini") as LLMID

    // ✨ مدیریت پیام سیستم
    const finalMessages = [
      {
        role: "system",
        content:
          MODEL_PROMPTS[selectedModel] || "You are a helpful AI assistant."
      },
      ...(Array.isArray(messages) ? messages : [])
    ]

    if (selectedModel === "dall-e-3") {
      return NextResponse.json(
        { message: "DALL-E 3 requests should be sent to /api/dalle/route.ts" },
        { status: 400 }
      )
    }

    if (selectedModel.includes("realtime")) {
      const response = await fetch(
        "https://api.openai.com/v1/realtime/sessions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${profile.openai_api_key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: selectedModel,
            voice: "alloy",
            instructions:
              MODEL_PROMPTS[selectedModel] ??
              "You are a realtime assistant speak persian and your name is rhyno voice.",
            tools: [
              {
                type: "function",
                name: "web_search",
                description: "Search the web for up-to-date information",
                parameters: {
                  type: "object",
                  properties: { query: { type: "string" } },
                  required: ["query"]
                }
              }
            ]
          })
        }
      )
      if (!response.ok) {
        const errorBody = await response.json()
        throw new Error(
          errorBody.error?.message || "Failed to create realtime session"
        )
      }
      const session = await response.json()
      const { error: insertError } = await supabase
        .from("realtime_sessions")
        .insert({
          user_id: userId,
          openai_session_id: session.id // یا هر فیلدی که ID جلسه در آن است
        })

      if (insertError) {
        console.error("Failed to save realtime session to DB:", insertError)
        // می‌توانید اینجا خطا را مدیریت کنید
      }
      return NextResponse.json(session)
    }

    const cs = chatSettings as ExtendedChatSettings
    const maxTokens = pickMaxTokens(cs)
    const temp = typeof cs.temperature === "number" ? cs.temperature : 1

    const useStream = !MODELS_THAT_SHOULD_NOT_STREAM.has(selectedModel)
    const enableSearch =
      typeof enableWebSearch === "boolean"
        ? enableWebSearch
        : MODELS_WITH_AUTO_SEARCH.has(selectedModel)
    const useOpenAIWebSearch =
      !!enableSearch && MODELS_WITH_OPENAI_WEB_SEARCH.has(selectedModel)

    // ✨ منطق Web Search
    if (useOpenAIWebSearch) {
      // بخش ۱: مدیریت مدل‌های غیر استریم وب‌سرچ (کد اصلی شما)
      if (["gpt-5", "gpt-5-mini"].includes(selectedModel)) {
        console.log(
          "🚀 [WEB-SEARCH] Entering NON-streaming web search block for model:",
          selectedModel
        )
        const response = await openai.responses.create({
          model: selectedModel,
          input: finalMessages.map(m =>
            m.role === "user"
              ? {
                  role: "user",
                  content: [{ type: "input_text", text: m.content as string }]
                }
              : m
          ) as any,
          tools: [{ type: "web_search" as any }],
          temperature: temp,
          max_output_tokens: maxTokens
        })

        // ✨ اضافه کردن منطق کسر هزینه برای حالت غیر استریم وب‌سرچ
        const usage = response.usage
        if (usage) {
          const userCostUSD = calculateUserCostUSD(selectedModel, {
            prompt_tokens: usage.input_tokens, // <-- تغییر از prompt_tokens
            completion_tokens: usage.output_tokens // <-- تغییر از completion_tokens
          })
          console.log(`📊 [WEB-SEARCH] Usage data received:`, usage)
          if (userCostUSD > 0 && wallet) {
            console.log(
              `💰 هزینه: ${userCostUSD} | کاربر: ${userId} | موجودی اولیه: ${wallet.balance}`
            )
            await supabase.rpc("deduct_credits_and_log_usage", {
              p_user_id: userId,
              p_model_name: selectedModel,
              p_prompt_tokens: usage.input_tokens, // <-- تغییر به input_tokens
              p_completion_tokens: usage.output_tokens, // <-- تغییر به output_tokens
              p_cost: userCostUSD
            })
            const { data: updatedWallet } = await supabase
              .from("wallets")
              .select("balance")
              .eq("user_id", userId)
              .single()
            console.log(
              `✅ عملیات موفق! | کاربر: ${userId} | موجودی جدید: ${updatedWallet?.balance}`
            )
          }
        }

        return new Response(response.output_text ?? "", {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        })
      }

      // بخش ۲: مدیریت مدل‌های استریم وب‌سرچ (مثل gpt-4o-mini)
      // این بخش فقط در صورتی اجرا می‌شود که شرط بالا برقرار نباشد
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          console.log(
            "🚀 [WEB-SEARCH] Entering STREAMING web search block for model:",
            selectedModel
          )
          let usage: ChatCompletionUsage | undefined

          try {
            const transformedInput = finalMessages.map(m => {
              if (m.role === "user")
                return {
                  ...m,
                  content: [{ type: "input_text", text: m.content as string }]
                }
              if (m.role === "assistant" && typeof m.content === "string")
                return {
                  ...m,
                  content: [{ type: "output_text", text: m.content }]
                }
              return m
            })

            const oaiStream = await openai.responses.stream({
              model: selectedModel,
              input: transformedInput as any,
              tools: [{ type: "web_search" as any }],
              temperature: temp,
              max_output_tokens: maxTokens
            })

            for await (const event of oaiStream as AsyncIterable<any>) {
              // console.log("EVENT FROM OPENAI:", JSON.stringify(event, null, 2));
              if (event.type === "response.output_text.delta") {
                controller.enqueue(encoder.encode(String(event.delta || "")))
              } else if (
                event.type === "response.completed" &&
                event.response?.usage
              ) {
                const receivedUsage = event.response.usage
                usage = {
                  prompt_tokens: receivedUsage.input_tokens,
                  completion_tokens: receivedUsage.output_tokens,
                  total_tokens: receivedUsage.total_tokens
                }
                // این لاگ حالا باید نمایش داده شود
                console.log("📊 [WEB-SEARCH] Usage data received:", usage)
              }
            }

            if (usage) {
              const userCostUSD = calculateUserCostUSD(selectedModel, usage)
              if (userCostUSD > 0 && wallet) {
                console.log(
                  `💰 هزینه: ${userCostUSD} | کاربر: ${userId} | موجودی اولیه: ${wallet.balance}`
                )
                await supabase.rpc("deduct_credits_and_log_usage", {
                  p_user_id: userId,
                  p_model_name: selectedModel,
                  p_prompt_tokens: usage.prompt_tokens,
                  p_completion_tokens: usage.completion_tokens,
                  p_cost: userCostUSD
                })
                const { data: updatedWallet } = await supabase
                  .from("wallets")
                  .select("balance")
                  .eq("user_id", userId)
                  .single()
                console.log(
                  `✅ عملیات موفق! | کاربر: ${userId} | موجودی جدید: ${updatedWallet?.balance}`
                )
              }
            }
          } catch (err: any) {
            console.error("❌ [WEB-SEARCH] Error in stream:", err)
            controller.enqueue(
              encoder.encode(
                `❌ خطا در وب‌سرچ: ${err?.message || "خطای ناشناخته"}`
              )
            )
          } finally {
            console.log("🚪 [WEB-SEARCH] Closing stream controller.")
            controller.close()
          }
        }
      })
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no"
        }
      })
    }
    // ✨ منطق استریم مدل‌های معمولی
    if (useStream) {
      const payload: ChatCompletionCreateParamsStreaming = {
        model: selectedModel,
        messages: finalMessages,
        stream: true,
        temperature: temp,
        max_tokens: maxTokens
      }
      if (MODELS_NEED_MAX_COMPLETION.has(selectedModel))
        (payload as any).max_completion_tokens = maxTokens

      const stream = await openai.chat.completions.create(payload)
      const encoder = new TextEncoder()
      const readableStream = new ReadableStream({
        async start(controller) {
          console.log(`🚀 [STREAM-DEBUG] Stream started for user: ${userId}`)
          let usage: ChatCompletionUsage | undefined
          try {
            for await (const chunk of stream) {
              if (chunk.usage) usage = chunk.usage
              console.log("📊 [STREAM-DEBUG] Usage data received:", usage)
              const delta = chunk.choices[0]?.delta?.content || ""
              if (delta) controller.enqueue(encoder.encode(delta))
            }
            console.log(
              "🏁 [STREAM-DEBUG] Stream loop finished. Checking for usage data..."
            )
            if (usage) {
              console.log(
                "✅ [STREAM-DEBUG] Usage data found. Proceeding with deduction logic."
              )

              const userCostUSD = calculateUserCostUSD(selectedModel, usage)
              console.log(
                `💰 Model: ${selectedModel}, UserID: ${userId}, CostUSD: ${userCostUSD}, Wallet balance before deduction: ${wallet?.balance}`
              )
              if (userCostUSD > 0 && wallet) {
                await supabase.rpc("deduct_credits_and_log_usage", {
                  p_user_id: userId,
                  p_model_name: selectedModel,
                  p_prompt_tokens: usage.prompt_tokens,
                  p_completion_tokens: usage.completion_tokens,
                  p_cost: userCostUSD
                })
                const { data: updatedWallet } = await supabase
                  .from("wallets")
                  .select("balance")
                  .eq("user_id", userId)
                  .single()

                console.log(
                  `✅ عملیات موفق! | کاربر: ${userId} | موجودی جدید: ${updatedWallet?.balance}`
                )
                console.log(
                  "💰 Credits deducted:",
                  userCostUSD,
                  "for user:",
                  userId
                )
              }
            }
          } finally {
            controller.close()
          }
        }
      })
      return new Response(readableStream, {
        headers: { "Content-Type": "text/event-stream; charset=utf-8" }
      })
    } else {
      const payload: ChatCompletionCreateParams = {
        model: selectedModel,
        messages: finalMessages,
        stream: false,
        temperature: temp,
        max_tokens: maxTokens
      }
      if (MODELS_NEED_MAX_COMPLETION.has(selectedModel))
        (payload as any).max_completion_tokens = maxTokens

      const response = await openai.chat.completions.create(payload)
      const content = response.choices[0].message.content ?? ""
      const usage = response.usage
      console.log("💡 Checking wallet and usage...")
      if (usage) {
        console.log("💡 Usage exists:", usage)
        const userCostUSD = calculateUserCostUSD(selectedModel, usage)
        console.log(
          `💰 Model: ${selectedModel}, UserID: ${userId}, CostUSD: ${userCostUSD}, Wallet balance before deduction: ${wallet?.balance}`
        )
        if (!wallet || wallet.balance < userCostUSD)
          return NextResponse.json(
            { message: "موجودی شما کافی نیست." },
            { status: 402 }
          )
        if (userCostUSD > 0) {
          console.log("⏳ Trying to deduct credits now...")
          await supabase.rpc("deduct_credits_and_log_usage", {
            p_user_id: userId,
            p_model_name: selectedModel,
            p_prompt_tokens: usage.prompt_tokens,
            p_completion_tokens: usage.completion_tokens,
            p_cost: userCostUSD
          })
          console.log(
            `✅ Credits deducted for UserID: ${userId}, CostUSD: ${userCostUSD}`
          )
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
    return NextResponse.json({ message: errorMessage }, { status })
  }
}
