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
import { handleTTS } from "@/app/api/chat/handlers/tts"
import { modelsWithRial } from "@/app/checkout/pricing"
import { handleSTT } from "@/app/api/chat/handlers/stt"

// از Node.js runtime استفاده می‌کنیم
export const runtime: ServerRuntime = "nodejs"
function isImageRequest(prompt: string): boolean {
  const lowerCasePrompt = prompt.toLowerCase()

  // کلیدواژه‌های اصلی برای شناسایی درخواست تصویر
  const imageNouns = [
    "عکس",
    "تصویر",
    "نقاشی",
    "طرح",
    "پوستر",
    "یه عکس از",
    "یه عکس",
    "یک عکس"
  ]
  const createVerbs = [
    "بساز",
    "بکش",
    "طراحی کن",
    "درست کن",
    "ایجاد کن",
    "یه عکس از"
  ]

  // آیا حداقل یکی از اسم‌های تصویر در متن هست؟
  const hasImageNoun = imageNouns.some(noun => lowerCasePrompt.includes(noun))

  // آیا حداقل یکی از فعل‌های ساختن در متن هست؟
  const hasCreateVerb = createVerbs.some(verb => lowerCasePrompt.includes(verb))

  // اگر هر دو شرط برقرار بود، یعنی درخواست ساخت تصویر است
  if (hasImageNoun && hasCreateVerb) {
    return true
  }

  // می‌توانید کلیدواژه‌های انگلیسی را هم برای اطمینان اضافه کنید
  const englishKeywords = ["generate image", "create a picture of", "draw a"]
  if (englishKeywords.some(keyword => lowerCasePrompt.includes(keyword))) {
    return true
  }

  return false
}

// تابع تشخیص ورودی گفتار به متن (STT)
// این تابع بررسی می‌کند که آیا آخرین پیام، یک فایل صوتی است یا خیر
function isSttRequest(messages: any[]): boolean {
  if (!messages || messages.length === 0) {
    return false
  }
  const lastMessage = messages[messages.length - 1]
  // بر اساس کد فرانت‌اند شما، پیام‌های صوتی کاربر این مدل را دارند
  return lastMessage.model === "user-audio"
}
function isMcpRequest(prompt: string): boolean {
  // کلمات کلیدی که مدل نانو را فراخوانی می‌کنند
  const keywords = ["mcp", "nano", "rhyno nano", "v5 nano"]
  const lowerCasePrompt = prompt.toLowerCase()

  // بررسی می‌کند که آیا پرامپت با یکی از کلمات کلیدی (همراه با : یا فاصله) شروع می‌شود یا خیر
  // این کار از فراخوانی اشتباهی جلوگیری می‌کند
  return keywords.some(
    word =>
      lowerCasePrompt.startsWith(word + ":") ||
      lowerCasePrompt.startsWith(word + " ")
  )
}
function isDocgenRequest(prompt: string): boolean {
  const lowerCasePrompt = prompt.toLowerCase()

  // لیست انواع فایل‌ها
  const docTypes = [
    "اکسل",
    "excel",
    "pdf",
    "پی دی اف",
    "word",
    "ورد",
    "document",
    "سند"
  ]

  // لیست کلمات کلیدی مربوط به ساختن یا تبدیل
  const createKeywords = [
    "بساز",
    "کن",
    "تولید کن",
    "درست کن",
    "خروجی",
    "output",
    "format",
    "در قالب"
  ]

  // بررسی می‌کنیم آیا حداقل یکی از انواع فایل در متن وجود دارد؟
  const hasDocType = docTypes.some(doc => lowerCasePrompt.includes(doc))

  // و آیا حداقل یکی از کلمات کلیدی ساختن در متن وجود دارد؟
  const hasCreateKeyword = createKeywords.some(keyword =>
    lowerCasePrompt.includes(keyword)
  )

  // اگر هر دو شرط برقرار بود، درخواست ساخت فایل است
  return hasDocType && hasCreateKeyword
}

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
const PROFIT_MARGIN = 1.4

function calculateUserCostUSD(
  modelId: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  // پیدا کردن مدل از modelsWithRial
  const model = modelsWithRial.find(m => m.id === modelId)
  if (!model) return 0

  const promptCost =
    (usage.prompt_tokens / 1_000_000) * model.inputPricePer1MTokenUSD
  const completionCost =
    (usage.completion_tokens / 1_000_000) * model.outputPricePer1MTokenUSD

  return (promptCost + completionCost) * PROFIT_MARGIN
}

const MODELS_NEED_MAX_COMPLETION = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-5",
  "gpt-5-nano",
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

const MODEL_MAX_TOKENS: Record<string, number> = {
  "gpt-4o": 8192,
  "gpt-4o-mini": 4096,
  "gpt-5": 12000,
  "gpt-5-mini": 12000,
  "gpt-3.5-turbo": 4096,
  "gpt-3.5-turbo-16k": 16384
  // سایر مدل‌ها را اضافه کن
}
function pickMaxTokens(cs: ExtendedChatSettings, modelId: string): number {
  const requestedTokens = cs.maxTokens ?? cs.max_tokens ?? 4096
  const modelLimit = MODEL_MAX_TOKENS[modelId] ?? 4096
  // مقدار نهایی نباید از سقف مدل بیشتر شود
  return Math.min(requestedTokens, modelLimit)
}

export async function POST(request: Request) {
  console.log("🔥🔥🔥 درخواست به API دریافت شد! شروع پردازش... 🔥🔥🔥")
  try {
    const { chatSettings, messages, enableWebSearch } = await request.json()

    console.log("--- RECEIVED MESSAGES ARRAY ---")
    console.log(JSON.stringify(messages, null, 2))
    console.log("-----------------------------")

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
    const lastUserMessage = messages[messages.length - 1]?.content || ""

    const selectedModel = (chatSettings.model || "gpt-4o-mini") as LLMID

    if (selectedModel === "gpt-4o-transcribe") {
      console.log("🎙️ درخواست STT به مسیر اشتباهی ارسال شده است.")
      // این شرط برای جلوگیری از سردرگمی است.
      // درخواست‌های STT باید به همراه فایل صوتی به /api/transcribe ارسال شوند.
      return NextResponse.json(
        {
          message:
            "درخواست‌های تبدیل گفتار به متن باید به مسیر /api/transcribe ارسال شوند."
        },
        { status: 400 } // Bad Request
      )
    }
    if (isImageRequest(lastUserMessage)) {
      console.log("🎨 درخواست ساخت تصویر شناسایی شد. هدایت به مسیر DALL-E...")

      // ساخت URL کامل برای مسیر DALL-E
      const dalleUrl = new URL("/api/chat/dalle", request.url)

      // ارسال درخواست به مسیر DALL-E با همان بدنه
      // فقط prompt را به آخرین پیام کاربر محدود می‌کنیم تا بهینه باشد
      const dalleResponse = await fetch(dalleUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ارسال کوکی‌ها برای اینکه احراز هویت در مسیر DALL-E هم کار کند
          Cookie: request.headers.get("Cookie") || ""
        },
        body: JSON.stringify({
          chatSettings, // تنظیمات چت را هم می‌فرستیم
          prompt: lastUserMessage // فقط آخرین پیام را به عنوان پرامپت می‌فرستیم
        })
      })
      // بلاک ۲: بررسی درخواست MCP (Nano)

      // بازگرداندن مستقیم پاسخ از مسیر DALL-E به کاربر
      // این پاسخ می‌تواند شامل URL عکس ساخته شده باشد
      return new Response(dalleResponse.body, {
        status: dalleResponse.status,
        headers: dalleResponse.headers
      })
    }
    if (isMcpRequest(lastUserMessage)) {
      console.log("🔹 درخواست MCP (Nano) شناسایی شد. هدایت به مسیر MCP...")
      const mcpUrl = new URL("/api/chat/mcp", request.url)

      // درخواست را با تمام محتوای اصلی به مسیر MCP فوروارد می‌کنیم
      const mcpResponse = await fetch(mcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("Cookie") || ""
        },
        // مسیر MCP احتمالاً به تمام اطلاعات نیاز دارد، نه فقط پرامپت
        body: JSON.stringify({ chatSettings, messages, enableWebSearch })
      })

      return new Response(mcpResponse.body, {
        status: mcpResponse.status,
        headers: mcpResponse.headers
      })
    }

    if (isDocgenRequest(lastUserMessage)) {
      console.log("📄 درخواست ساخت فایل شناسایی شد. هدایت به مسیر DocGen...")

      // توجه: فرض می‌کنیم شما یک مسیر API جدید در /api/chat/docgen ساخته‌اید
      const docgenUrl = new URL("/api/chat/mcp", request.url)

      const docgenResponse = await fetch(docgenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("Cookie") || ""
        },
        body: JSON.stringify({ chatSettings, messages, enableWebSearch })
      })

      // پاسخ از این مسیر می‌تواند یک لینک دانلود یا خود فایل باشد
      return new Response(docgenResponse.body, {
        status: docgenResponse.status,
        headers: docgenResponse.headers
      })
    }

    if (selectedModel === "gpt-5-nano") {
      console.log("🚀 درخواست gpt-5-nano شناسایی شد. هدایت به /api/chat/mcp...")

      // ساخت URL کامل برای مسیر جدید
      const mcpUrl = new URL("/api/chat/mcp", request.url)

      // ارسال درخواست به مسیر جدید با همان بدنه و هدرها
      const mcpResponse = await fetch(mcpUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ارسال کوکی‌ها برای احراز هویت در مسیر جدید
          Cookie: request.headers.get("Cookie") || ""
        },
        // ارسال دوباره اطلاعاتی که از بدنه درخواست خوانده بودیم
        body: JSON.stringify({ chatSettings, messages, enableWebSearch })
      })

      // بازگرداندن مستقیم پاسخ (استریم یا غیر استریم) از مسیر MCP به کاربر
      return new Response(mcpResponse.body, {
        status: mcpResponse.status,
        headers: mcpResponse.headers
      })
    }
    // اگر مدل انتخاب شده برای تبدیل متن به گفتار است، آن را به کنترل‌کننده مربوطه بفرست
    if (selectedModel === "gpt-4o-mini-tts") {
      console.log("🔊 درخواست TTS شناسایی شد. ارسال به handleTTS...")

      // آخرین پیام کاربر را به عنوان ورودی در نظر بگیر
      const input = messages[messages.length - 1]?.content || ""
      if (!input) {
        return NextResponse.json(
          { message: "Input text is required for TTS." },
          { status: 400 }
        )
      }

      // بدنه درخواست را برای handleTTS بساز
      const ttsBody = {
        input,
        voice: chatSettings.voice || "coral",
        speed: chatSettings.speed || 1.0, // استفاده از صدای پیش‌فرض در صورت عدم وجود
        model: selectedModel
      }

      // درخواست را به کنترل‌کننده TTS ارسال کرده و نتیجه را بازگردان
      return await handleTTS({
        body: ttsBody,
        user,
        supabase
      })
    }
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
        {
          message:
            "DALL-E 3 requests should be sent to /api/chat/dalle/route.ts"
        },
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
            instructions: `
  You are Rhyno, a realtime Persian-speaking assistant.
  ✅ Always respond in Persian (Farsi).
  ✅ Only speak in voice (no text output).
  ✅ Introduce yourself as Rhyno when asked.
  ✅ Keep your answers short and concise. Do not over-explain.
`,

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
      console.log("🌐 Realtime session raw response:", session)
      console.log("🔊 Session modalities:", session.modalities)
      console.log("🔊 Session voice:", session.voice)
      console.log("🔊 Session instructions:", session.instructions)

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
    const maxTokens = pickMaxTokens(cs, selectedModel)
    const temp = typeof cs.temperature === "number" ? cs.temperature : 1
    const hasImage = messages.some(
      (message: any) =>
        Array.isArray(message.content) &&
        message.content.some((part: any) => part.type === "image_url")
    )
    const useStream = !MODELS_THAT_SHOULD_NOT_STREAM.has(selectedModel)
    const enableSearch =
      typeof enableWebSearch === "boolean"
        ? enableWebSearch
        : MODELS_WITH_AUTO_SEARCH.has(selectedModel)
    const useOpenAIWebSearch =
      !!enableSearch &&
      MODELS_WITH_OPENAI_WEB_SEARCH.has(selectedModel) &&
      !hasImage // ✨

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
    const userPrompt = finalMessages[finalMessages.length - 1]
      ?.content as string

    // ✨ منطق استریم مدل‌های معمولی
    if (useStream) {
      const payload: ChatCompletionCreateParamsStreaming = {
        model: selectedModel,
        messages: finalMessages,
        stream: true,
        temperature: temp
      }

      if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
        ;(payload as any).max_completion_tokens = maxTokens
      } else {
        payload.max_tokens = maxTokens
      }

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
            } else {
              // 📌 fallback وقتی usage از استریم نیاد
              console.log(
                "⚠️ No usage data from stream. Trying fallback non-stream request..."
              )
              const usageResponsePayload: ChatCompletionCreateParams = {
                model: selectedModel,
                messages: finalMessages,
                temperature: temp,
                stream: false
              }

              if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
                ;(usageResponsePayload as any).max_completion_tokens = maxTokens
              } else {
                usageResponsePayload.max_tokens = maxTokens
              }

              const usageResponse =
                await openai.chat.completions.create(usageResponsePayload)

              console.log(
                "✅ FALLBACK RESPONSE:",
                JSON.stringify(usageResponse, null, 2)
              )
              const content = usageResponse.choices[0]?.message?.content
              // if (content) {
              //   controller.enqueue(encoder.encode(content))
              // }
              if (usageResponse.usage) {
                const userCostUSD = calculateUserCostUSD(
                  selectedModel,
                  usageResponse.usage
                )
                console.log(
                  "📊 Usage from fallback request:",
                  usageResponse.usage
                )
                console.log(
                  `💰 [FALLBACK] Model: ${selectedModel}, UserID: ${userId}, CostUSD: ${userCostUSD}, Wallet balance before deduction: ${wallet?.balance}`
                )

                if (userCostUSD > 0 && wallet) {
                  await supabase.rpc("deduct_credits_and_log_usage", {
                    p_user_id: userId,
                    p_model_name: selectedModel,
                    p_prompt_tokens: usageResponse.usage.prompt_tokens,
                    p_completion_tokens: usageResponse.usage.completion_tokens,
                    p_cost: userCostUSD
                  })
                  console.log(
                    `✅ Credits deducted with fallback | User: ${userId}`
                  )

                  const { data: updatedWallet } = await supabase
                    .from("wallets")
                    .select("balance")
                    .eq("user_id", userId)
                    .single()

                  console.log(
                    `✅ [FALLBACK] عملیات موفق! | کاربر: ${userId} | هزینه: ${userCostUSD} | موجودی جدید: ${updatedWallet?.balance}`
                  )
                }
              }
            }
          } catch (err: any) {
            // ++ این بلوک CATCH اضافه شده است ++
            console.error("❌ ERROR INSIDE STREAM/FALLBACK:", err)
            const errorMessage = `خطای سرور: ${err.message || "خطای ناشناخته"}`
            controller.enqueue(encoder.encode(errorMessage))
          } finally {
            // شروع FINALLY
            console.log("🚪 [STREAM-DEBUG] Closing stream controller.")
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
        temperature: temp
      }
      if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
        ;(payload as any).max_completion_tokens = maxTokens
      } else {
        payload.max_tokens = maxTokens
      }
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
