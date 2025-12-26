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

import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { OPENAI_LLM_LIST } from "@/lib/models/llm/openai-llm-list"
import { handleTTS } from "@/app/api/chat/handlers/tts"
import { modelsWithRial } from "@/app/checkout/pricing"
import { handleSTT } from "@/app/api/chat/handlers/stt"
import jwt from "jsonwebtoken"
import { createClient as createAdminClient } from "@supabase/supabase-js"
// ✅ این خط را اضافه کنید
import { encode } from "gpt-tokenizer"
import { quickResponses } from "@/lib/quick-responses"
import { StreamingTextResponse } from "ai"

// از Node.js runtime استفاده می‌کنیم
export const runtime: ServerRuntime = "nodejs"
export const maxDuration = 60

// --- ⬇️ تغییر ۱: مدل‌های OpenRouter را اینجا تعریف می‌کنیم ---
const OPENROUTER_GEMINI_MODEL_ID = "google/gemini-2.5-flash-image"

/**
 * مدل‌هایی که باید به کنترل‌کننده اختصاصی OpenRouter هدایت شوند.
 * این کنترل‌کننده (/api/chat/openrouter) مسئول تماس با API OpenRouter
 * و استریم کردن پاسخ است.
 */
const OPENROUTER_MODELS = new Set([
  OPENROUTER_GEMINI_MODEL_ID,
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5-codex"
])
// --- ⬆️ پایان تغییر ۱ ---

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
  "gpt-5-mini",
  "gpt-5-codex"
])
const MODELS_THAT_SHOULD_NOT_STREAM = new Set([
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-codex"
])
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
  "gpt-5-nano": 5000,
  "gpt-3.5-turbo-16k": 16384
  // سایر مدل‌ها را اضافه کن
}
const MODELS_WITH_PRIORITY_TIER = new Set([
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5-codex"
])

function pickMaxTokens(cs: ExtendedChatSettings, modelId: string): number {
  const requestedTokens = cs.maxTokens ?? cs.max_tokens ?? 4096
  const modelLimit = MODEL_MAX_TOKENS[modelId] ?? 4096
  // مقدار نهایی نباید از سقف مدل بیشتر شود
  return Math.min(requestedTokens, modelLimit)
}
function normalizeQuickInput(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      // حذف تمام علائم نگارشی رایج (فارسی و انگلیسی)
      .replace(/[.,،؟?!]/g, "")
  )
  // می‌توانید موارد بیشتری اضافه کنید
  // مثلاً: .replace(/ي/g, "ی").replace(/ك/g, "ک")
}
export async function POST(request: Request) {
  console.log("🔥🔥🔥 درخواست به API دریافت شد! شروع پردازش... 🔥🔥🔥")
  try {
    const requestBody = await request.json()
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized: Missing Bearer token", {
        status: 401
      })
    }
    const token = authHeader.split(" ")[1]
    // const tokenCount = tokens.length;
    let userId: string

    // ۱. اعتبارسنجی دستی توکن با JWT_SECRET
    try {
      if (!process.env.SUPABASE_JWT_SECRET) {
        throw new Error("SUPABASE_JWT_SECRET is not set on server!")
      }
      // توکن را با «راز» (Secret) که در Vercel ست کردید، باز می‌کنیم
      const decodedToken = jwt.verify(
        token,
        process.env.SUPABASE_JWT_SECRET
      ) as jwt.JwtPayload

      if (!decodedToken.sub) {
        throw new Error("Invalid token: No 'sub' (user ID) found.")
      }
      userId = decodedToken.sub // 'sub' (Subject) همان User ID است
      console.log(`✅ Token MANUALLY verified! User ID: ${userId}`)
    } catch (err: any) {
      // اگر «راز» شما در Vercel اشتباه باشد، این بخش اجرا می‌شود
      console.error("❌ Manual JWT Verification Failed:", err.message)
      return new NextResponse(
        `Unauthorized: Manual verification failed: ${err.message}`,
        { status: 401 }
      )
    }

    // ۲. ساخت کلاینت ادمین (Admin) برای گرفتن آبجکت کامل User
    // (این کار تمام ارورهای TypeScript قبلی را حل می‌کند)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on server!")
    }

    // از createClient معمولی با کلید SERVICE_ROLE استفاده می‌کنیم
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // با استفاده از کلاینت ادمین، آبجکت کامل user را می‌گیریم
    const {
      data: { user },
      error: adminError
    } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (adminError || !user) {
      console.error("❌ Admin client failed to get user:", adminError?.message)
      return new NextResponse(
        `Unauthorized: User not found with admin client: ${adminError?.message}`,
        { status: 401 }
      )
    }

    // ✅ حالا ما آبجکت User کامل را داریم (برای handleTTS و...)
    console.log(`✅ Full user object retrieved for: ${user.email}`)
    const { isUsageReport, modelId, usage } = requestBody
    if (isUsageReport === true && modelId && usage) {
      console.log(`📊 [REALTIME-USAGE] دریافت گزارش هزینه برای مدل: ${modelId}`)

      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single()

      if (walletError || !wallet) {
        console.error(
          "❌ [REALTIME-USAGE] خطای دسترسی به کیف پول:",
          walletError?.message
        )
        return NextResponse.json(
          { message: "Wallet not found for usage report" },
          { status: 400 }
        )
      }

      const userCostUSD = calculateUserCostUSD(modelId, {
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens
      })

      console.log(`💰 [REALTIME-USAGE] هزینه محاسبه شده: ${userCostUSD} USD`)

      if (userCostUSD > 0 && wallet.balance >= userCostUSD) {
        await supabaseAdmin.rpc("deduct_credits_and_log_usage", {
          p_user_id: userId,
          p_model_name: modelId,
          p_prompt_tokens: usage.input_tokens,
          p_completion_tokens: usage.output_tokens,
          p_cost: userCostUSD
        })
        console.log(`✅ [REALTIME-USAGE] هزینه با موفقیت کسر شد.`)
      } else if (userCostUSD > 0) {
        console.warn(
          `⚠️ [REALTIME-USAGE] موجودی کافی نیست. هزینه: ${userCostUSD}, موجودی: ${wallet.balance}`
        )
      } else {
        console.log("ℹ️ [REALTIME-USAGE] هزینه صفر بود، نیازی به کسر نیست.")
      }

      // ❗️❗️❗️ مهم: بعد از پردازش گزارش، خارج شوید
      return NextResponse.json(
        { success: true, message: "Usage reported." },
        { status: 200 }
      )
    }
    const {
      chatSettings,
      messages,
      enableWebSearch,
      input,
      chat_id,
      is_user_message_saved
    } = requestBody
    // console.log("--- RECEIVED MESSAGES ARRAY ---")
    // console.log(JSON.stringify(messages, null, 2))
    // console.log("-----------------------------")
    let selectedModel = (chatSettings.model || "gpt-4o-mini") as LLMID

    const cookieStore = cookies()
    const supabase = createSSRClient(cookieStore)

    console.log(`✅ User ${userId} successfully authenticated via Supabase.`)
    // ✅ اصلاح شده: اگر چت آیدی وجود نداشت، چک کن که آیا مدل ریل‌تایم است یا نه
    const modelFromSettings = chatSettings?.model || ""

    // فقط اگر مدل، متنی عادی بود، وجود messages را چک کن
    if (
      (!messages || !Array.isArray(messages) || messages.length === 0) &&
      !modelFromSettings.includes("realtime") &&
      !modelFromSettings.includes("tts")
    ) {
      console.error(
        "⛔️ FATAL: 'messages' array is missing for this model type!"
      )
      return NextResponse.json(
        {
          message: "Missing 'messages' array for non-TTS/non-Realtime request."
        },
        { status: 400 }
      )
    }
    // // ✅✅✅ چک را به اینجا منتقل کنید ✅✅✅
    if (
      !modelFromSettings.includes("realtime") && // 👈 این شرط اضافه شد
      !modelFromSettings.includes("tts") && // 👈 این شرط اضافه شد
      (!messages || !Array.isArray(messages) || messages.length === 0)
    ) {
      console.error(
        "⛔️ FATAL: 'messages' array is missing for this model type!"
      )
      return NextResponse.json(
        {
          message: "Missing 'messages' array for non-TTS/non-Realtime request."
        },
        { status: 400 }
      )
    }
    // ✅✅✅ پایان انتقال ✅✅✅

    console.log(`DEBUG: Processing request for chat_id: ${chat_id}`)

    // متغیرها را بیرون از بلاک تعریف کنید
    let lastUserMessage
    let userMessageContent = "" // مقداردهی اولیه
    let userImagePaths: string[] = [] // مقداردهی اولیه

    // ✅✅✅ این شرط حیاتی را اضافه کنید ✅✅✅
    if (
      !modelFromSettings.includes("realtime") &&
      !modelFromSettings.includes("tts")
    ) {
      // --- شروع بلاک منتقل شده ---
      // حالا این خط امن است چون می‌دانیم messages وجود دارد
      lastUserMessage = messages[messages.length - 1]
      userMessageContent = lastUserMessage.content

      // (اگر پیام حاوی عکس است، فقط متن را جدا می‌کنیم)
      if (typeof lastUserMessage.content === "string") {
        // حالت ساده: فقط متن
        userMessageContent = lastUserMessage.content
        userImagePaths = []
      } else if (Array.isArray(lastUserMessage.content)) {
        // حالت پیچیده: آرایه‌ای از متن و عکس
        const textPart = lastUserMessage.content.find(
          (p: any) => p.type === "text"
        )
        userMessageContent = textPart ? textPart.text : ""
        userImagePaths = lastUserMessage.content
          .filter((p: any) => p.type === "image_url" && p.image_url?.url)
          .map((p: any) => p.image_url.url)
      }

      if (is_user_message_saved !== true) {
        // ۳. پیام کاربر را در دیتابیس ذخیره کنید
        if (userMessageContent || userImagePaths.length > 0) {
          try {
            console.log(
              "DEBUG: Saving user message to DB (client did not save)..."
            )
            const userSequenceNumber = messages.length - 1
            const { error: insertUserMsgError } = await supabaseAdmin
              .from("messages")
              .insert({
                chat_id: chat_id,
                user_id: userId,
                role: "user",
                content: userMessageContent,
                model: chatSettings.model,
                image_paths: userImagePaths,
                sequence_number: userSequenceNumber
              })
            if (insertUserMsgError) {
              console.error(
                "❌ ERROR saving user message:",
                insertUserMsgError.message
              )
            } else {
              console.log("✅ User message saved to DB.")
            }
          } catch (e: any) {
            console.error("❌ EXCEPTION saving user message:", e.message)
          }
        }
      } else {
        console.log("DEBUG: Skipping user message save (client already saved).")
      }

      if (userMessageContent) {
        const normalizedInput = normalizeQuickInput(userMessageContent)
        const response = quickResponses[normalizedInput]
        if (response) {
          console.log(
            `⚡️ [LEVEL 0] Sending instant reply for: "${normalizedInput}"`
          )

          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(response))
              controller.close()
            }
          })

          return new Response(stream, {
            /* ... headers ... */
          })
        }
      }
    } // --- ✅✅✅ پایان بلوک Paste شده ---

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", userId) // ✅ از userId استخراج شده استفاده می‌کنیم
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

    const profile = await getServerProfile(userId, supabaseAdmin)
    checkApiKey(profile.openai_api_key, "OpenAI")
    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    if (OPENROUTER_MODELS.has(selectedModel)) {
      console.log(
        `🔄 [ROUTER] Redirecting request for model ${selectedModel} to /api/chat/openrouter...`
      )
      const openrouterUrl = new URL("/api/chat/openrouter", request.url)
      const openrouterResponse = await fetch(openrouterUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // توکن موبایل و کوکی وب‌سایت را برای احراز هویت به مسیر بعدی پاس بده
          Authorization: request.headers.get("Authorization") || "",
          Cookie: request.headers.get("Cookie") || ""
        },
        body: JSON.stringify(requestBody)
      })

      // پاسخ (استریم یا غیر استریم) را مستقیماً به کاربر برگردان
      return new Response(openrouterResponse.body, {
        status: openrouterResponse.status,
        headers: openrouterResponse.headers
      })
    }
    // --- ⬆️ پایان تغییر ۲ ---

    if (selectedModel === "gpt-4o-mini-tts") {
      // console.log("🔊 درخواست TTS شناسایی شد.")

      const ttsInput =
        input ||
        (messages && messages.length > 0
          ? messages[messages.length - 1]?.content
          : "") ||
        ""

      if (!ttsInput) {
        return NextResponse.json(
          { message: "Input text is required for TTS." },
          { status: 400 }
        )
      }
      const ttsBody = {
        input: ttsInput,
        voice: chatSettings.voice || "coral",
        speed: chatSettings.speed || 1.0,
        model: selectedModel,
        chat_id: chat_id
      }

      return await handleTTS({
        request, // 👈 اینو اضافه کن
        body: ttsBody,
        user,
        supabase: supabaseAdmin
      })
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
            // 🟢 تغییرات مهم در اینجا اعمال شد:
            instructions: `
  You are Rhyno, a realtime Persian-speaking assistant.
  
  CORE RULES:
  ✅ Always respond in Persian (Farsi).
  ✅ Only speak in voice (no text output).
  ✅ Introduce yourself as Rhyno when asked.
  ✅ Keep your answers short and concise.
  
  SPECIAL INSTRUCTION FOR "AZAR YORD":
  If the user asks about "Azar Yord" (آذریورد) or "Azar Yord Tabriz", you MUST use the "web_search" tool.
  Context: Azar Yord is a specific entity found at "https://azaryourdtabriz.com/".
  Action: When searching, construct your query to specifically target this site (e.g., "site:azaryourdtabriz.com about" or "site:azaryourdtabriz.com services").
  Goal: Read the information from the search results related to that website and explain it to the user in Persian. Do not just give the link; explain what they do based on the search results.
  `,
            tools: [
              {
                type: "function",
                name: "web_search",
                description:
                  "Search the web for up-to-date information. Use this when asked about specific entities or current events.",
                parameters: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description:
                        "The search query. For specific sites, use 'site:domain.com keyword'."
                    }
                  },
                  required: ["query"]
                }
              }
            ]
          })
        }
      )
      if (!response.ok) {
        const errorBody = await response.json()
        console.error("❌ OpenAI Realtime Error Body:", errorBody) // ✨ این خط را اضافه کنید
        throw new Error(
          errorBody.error?.message || "Failed to create realtime session"
        )
      }
      const session = await response.json()
      // console.log("🌐 Realtime session raw response:", session)
      // console.log("🔊 Session modalities:", session.modalities)
      // console.log("🔊 Session voice:", session.voice)
      // console.log("🔊 Session instructions:", session.instructions)
      console.log(
        "🌐 Realtime session raw response from OpenAI:",
        JSON.stringify(session, null, 2)
      ) // ✨ این خط را فعال کنید!
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

    function extractTextFromContent(content: any): string {
      if (!content && content !== 0) return ""
      if (typeof content === "string") return content
      // اگر content آرایه از پارت‌هاست (مثل [{type:"input_text", text: "..."}])
      if (Array.isArray(content)) {
        return content
          .map(part => {
            if (typeof part === "string") return part
            if (part == null) return ""
            if (typeof part === "object") {
              // انواع معمولی که ممکنه داخل باشن
              return (
                part.text ??
                part.content ??
                part.name ??
                JSON.stringify(part)
              ).toString()
            }
            return String(part)
          })
          .filter(Boolean)
          .join(" ")
      }
      // اگر آبجکت ساده‌ست
      if (typeof content === "object") {
        return (
          content.text ??
          content.content ??
          JSON.stringify(content)
        ).toString()
      }
      return String(content)
    }

    // سپس

    if (selectedModel === "gpt-4o-transcribe") {
      // console.log("🎙️ درخواست STT به مسیر اشتباهی ارسال شده است.")
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

    // if (isDocgenRequest(lastUserMessage)) {
    //   // console.log("📄 درخواست ساخت فایل شناسایی شد. هدایت به مسیر DocGen...")

    //   // توجه: فرض می‌کنیم شما یک مسیر API جدید در /api/chat/docgen ساخته‌اید
    //   const docgenUrl = new URL("/api/chat/mcp", request.url)

    //   const docgenResponse = await fetch(docgenUrl, {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Cookie: request.headers.get("Cookie") || ""
    //     },
    //     body: JSON.stringify({ chatSettings, messages, enableWebSearch })
    //   })

    //   // پاسخ از این مسیر می‌تواند یک لینک دانلود یا خود فایل باشد
    //   return new Response(docgenResponse.body, {
    //     status: docgenResponse.status,
    //     headers: docgenResponse.headers
    //   })
    // }

    // if (selectedModel === "gpt-5-nano") {
    //   console.log("🚀 درخواست gpt-5-nano شناسایی شد. هدایت به /api/chat/mcp...")

    //   // ساخت URL کامل برای مسیر جدید
    //   const mcpUrl = new URL("/api/chat/mcp", request.url)

    //   // ارسال درخواست به مسیر جدید با همان بدنه و هدرها
    //   const mcpResponse = await fetch(mcpUrl, {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       // ارسال کوکی‌ها برای احراز هویت در مسیر جدید
    //       Cookie: request.headers.get("Cookie") || ""
    //     },
    //     // ارسال دوباره اطلاعاتی که از بدنه درخواست خوانده بودیم
    //     body: JSON.stringify({ chatSettings, messages, enableWebSearch })
    //   })

    //   // بازگرداندن مستقیم پاسخ (استریم یا غیر استریم) از مسیر MCP به کاربر
    //   return new Response(mcpResponse.body, {
    //     status: mcpResponse.status,
    //     headers: mcpResponse.headers
    //   })
    // }
    // اگر مدل انتخاب شده برای تبدیل متن به گفتار است، آن را به کنترل‌کننده مربوطه بفرست

    // ✨ مدیریت پیام سیستم
    const CHAT_HISTORY_LIMIT = 20

    // مطمئن می‌شویم که 'messages' یک آرایه است
    const validMessages = Array.isArray(messages) ? messages : []

    // پیام‌ها را از انتها برش می‌زنیم تا فقط N تای آخر باقی بمانند
    const recentMessages = validMessages.slice(-CHAT_HISTORY_LIMIT)

    // ✨ مدیریت پیام سیستم
    const finalMessages = [
      {
        role: "system",
        content:
          MODEL_PROMPTS[selectedModel] || "You are a helpful AI assistant."
      },
      ...recentMessages // ✅ به جای کل 'messages'، از 'recentMessages' استفاده می‌کنیم
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
      if (["gpt-5", "gpt-5-mini", "gpt-5-codex"].includes(selectedModel)) {
        // ✅ اصلاح شد
        // console.log(
        //   "🚀 [WEB-SEARCH] Entering NON-streaming web search block for model:",
        //   selectedModel
        // )
        const webSearchPayload: any = {
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
        }

        if (MODELS_WITH_PRIORITY_TIER.has(selectedModel)) {
          webSearchPayload.service_tier = "default"
        }
        console.log(
          "🚀 [PRIORITY-CHECK] Web Search Payload:",
          JSON.stringify(webSearchPayload, null, 2)
        )
        const response = await openai.responses.create(webSearchPayload)

        // ✨ اضافه کردن منطق کسر هزینه برای حالت غیر استریم وب‌سرچ
        const usage = response.usage
        if (usage) {
          const userCostUSD = calculateUserCostUSD(selectedModel, {
            prompt_tokens: usage.input_tokens, // <-- تغییر از prompt_tokens
            completion_tokens: usage.output_tokens // <-- تغییر از completion_tokens
          })
          // console.log(`📊 [WEB-SEARCH] Usage data received:`, usage)
          if (userCostUSD > 0 && wallet) {
            // console.log(
            //   `💰 هزینه: ${userCostUSD} | کاربر: ${userId} | موجودی اولیه: ${wallet.balance}`
            // )
            await supabaseAdmin.rpc("deduct_credits_and_log_usage", {
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
            // console.log(
            //   `✅ عملیات موفق! | کاربر: ${userId} | موجودی جدید: ${updatedWallet?.balance}`
            // )
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
          // console.log(
          //   "🚀 [WEB-SEARCH] Entering STREAMING web search block for model:",
          //   selectedModel
          // )
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
                // console.log("📊 [WEB-SEARCH] Usage data received:", usage)
              }
            }

            if (usage) {
              const userCostUSD = calculateUserCostUSD(selectedModel, usage)
              if (userCostUSD > 0 && wallet) {
                // console.log(
                //   `💰 هزینه: ${userCostUSD} | کاربر: ${userId} | موجودی اولیه: ${wallet.balance}`
                // )
                await supabaseAdmin.rpc("deduct_credits_and_log_usage", {
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
                // console.log(
                //   `✅ عملیات موفق! | کاربر: ${userId} | موجودی جدید: ${updatedWallet?.balance}`
                // )
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
            // console.log("🚪 [WEB-SEARCH] Closing stream controller.")
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
    const userPrompt = extractTextFromContent(
      finalMessages[finalMessages.length - 1]?.content
    )
    if (useStream) {
      const payload: ChatCompletionCreateParamsStreaming = {
        model: selectedModel,
        messages: finalMessages,
        stream: true,
        temperature: temp,
        user: userId
        // ... (max_tokens, service_tier مثل قبل)
      }
      if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
        ;(payload as any).max_completion_tokens = maxTokens
      } else {
        payload.max_tokens = maxTokens
      }
      if (MODELS_WITH_PRIORITY_TIER.has(selectedModel)) {
        ;(payload as any).service_tier = "default" // یا "default" بر اساس نیاز
      }

      const stream = await openai.chat.completions.create(payload)
      const encoder = new TextEncoder()
      let usage: ChatCompletionUsage | undefined // متغیر usage بیرون حلقه تعریف شود
      let fullAssistantResponse = ""
      let calculated_prompt_tokens = 0
      try {
        // ما باید محتوای تمام پیام‌ها را بشماریم
        for (const message of finalMessages) {
          // از تابع کمکی که خودتان نوشته بودید استفاده می‌کنیم
          const content = extractTextFromContent(message.content)
          calculated_prompt_tokens += encode(content).length
        }
        console.log(
          `📊 [TIKTOKEN] Calculated Prompt Tokens: ${calculated_prompt_tokens}`
        )
      } catch (e: any) {
        console.error(
          "❌ [TIKTOKEN] Error calculating prompt tokens:",
          e.message
        )
        // اگر محاسبه شکست خورد، به عنوان صفر ادامه می‌دهیم تا برنامه متوقف نشود
      }
      const readableStream = new ReadableStream({
        async start(controller) {
          console.log(`🚀 [STREAM-DEBUG] Stream started for user: ${userId}`)

          try {
            // --- 1. حلقه Stream (کد اصلی و صحیح شما) ---
            for await (const chunk of stream) {
              // این لاگ را می‌توانید حذف کنید، چون می‌دانیم 'usage' اینجا نیست
              // if (chunk.usage) {
              //   usage = chunk.usage
              //   console.log("📊 [STREAM-DEBUG] Potential Usage data:", usage)
              // }

              const delta = chunk.choices[0]?.delta?.content || ""
              if (delta) {
                // ارسال تکه متن به کلاینت
                fullAssistantResponse += delta
                console.log(`➡️ [STREAM-SENDING] Delta: "${delta}"`)
                controller.enqueue(encoder.encode(delta))
              }
            }
            // --- 👆 پایان حلقه Stream ---

            console.log("🏁 [STREAM-DEBUG] Stream loop finished.")
          } catch (err: any) {
            console.error("❌ ERROR DURING STREAM PROCESSING:", err)
            controller.enqueue(
              encoder.encode(
                `\n❌ خطای سرور: ${err.message || "خطای ناشناخته"}`
              )
            )
          } finally {
            console.log("🚪 [STREAM-DEBUG] Closing stream controller.")
            // ۱. استریم را به کلاینت می‌بندیم
            controller.close()

            // ۲. توکن‌های خروجی (Completion) را می‌شماریم
            let calculated_completion_tokens = 0
            try {
              if (fullAssistantResponse.trim().length > 0) {
                calculated_completion_tokens = encode(
                  // ✅✅✅ اصلاح شد
                  fullAssistantResponse.trim()
                ).length
                console.log(
                  `📊 [TIKTOKEN] Calculated Completion Tokens: ${calculated_completion_tokens}`
                )
              }
            } catch (e: any) {
              console.error(
                "❌ [TIKTOKEN] Error calculating completion tokens:",
                e.message
              )
            }

            // ۳. آبجکت 'usage' را خودمان می‌سازیم
            // (از 'calculated_prompt_tokens' که بیرون استریم حساب کردیم استفاده می‌کنیم)
            const usage = {
              prompt_tokens: calculated_prompt_tokens,
              completion_tokens: calculated_completion_tokens,
              total_tokens:
                calculated_prompt_tokens + calculated_completion_tokens
            }

            // ۴. کسر هزینه (حالا همیشه 'usage' را داریم)
            if (usage.prompt_tokens > 0 || usage.completion_tokens > 0) {
              console.log(
                "✅ [TIKTOKEN-FINAL] Usage data available. Proceeding with deduction."
              )
              const userCostUSD = calculateUserCostUSD(selectedModel, usage)
              if (userCostUSD > 0 && wallet) {
                // ... (کد کسر هزینه شما با supabaseAdmin.rpc) ...
                await supabaseAdmin.rpc("deduct_credits_and_log_usage", {
                  p_user_id: userId,
                  p_model_name: selectedModel,
                  p_prompt_tokens: usage.prompt_tokens,
                  p_completion_tokens: usage.completion_tokens,
                  p_cost: userCostUSD
                })
                console.log(
                  `✅ Cost deducted: ${userCostUSD} for user ${userId}`
                )
              }
            } else {
              console.warn("⚠️ Usage was zero. Skipping deduction.")
            }

            // ۵. ذخیره پیام دستیار (کد قبلی شما)
            if (is_user_message_saved !== true) {
              // فقط برای موبایل
              if (fullAssistantResponse.trim().length > 0) {
                try {
                  console.log(
                    "DEBUG: Saving assistant message to DB (Mobile client)..."
                  )
                  const { error: insertAsstMsgError } = await supabaseAdmin
                    .from("messages")
                    .insert({
                      chat_id: chat_id,
                      user_id: userId,
                      role: "assistant",
                      content: fullAssistantResponse.trim(),
                      model: selectedModel,
                      prompt_tokens: usage?.prompt_tokens || 0,
                      completion_tokens: usage?.completion_tokens || 0,
                      image_paths: [],
                      sequence_number: messages.length
                    })
                  if (insertAsstMsgError) {
                    console.error(
                      "❌ ERROR saving assistant message:",
                      insertAsstMsgError.message
                    )
                  } else {
                    console.log(
                      "✅ Assistant message saved to DB (Mobile client)."
                    )
                  }
                } catch (e: any) {
                  console.error(
                    "❌ EXCEPTION saving assistant message:",
                    e.message
                  )
                }
              }
            } else {
              console.log(
                "DEBUG: Skipping assistant message save (Web client will save)."
              )
            }
          }
        }
      })

      // ✅✅✅ راه حل نهایی: فقط زمانی ذخیره کن که کلاینت خودش ذخیره نکرده باشد
      //   if (is_user_message_saved !== true) {
      //     if (fullAssistantResponse.trim().length > 0) {
      //       try {
      //         console.log(
      //           "DEBUG: Saving assistant message to DB (Mobile client)..."
      //         ) // لاگ را آپدیت کردم
      //         const { error: insertAsstMsgError } = await supabaseAdmin
      //           .from("messages")
      //           .insert({
      //             chat_id: chat_id,
      //             user_id: userId,
      //             role: "assistant",
      //             content: fullAssistantResponse.trim(),
      //             model: selectedModel,
      //             prompt_tokens: usage?.prompt_tokens || 0,
      //             completion_tokens: usage?.completion_tokens || 0,
      //             image_paths: [],
      //             sequence_number: messages.length
      //           })
      //         if (insertAsstMsgError) {
      //           console.error(
      //             "❌ ERROR saving assistant message:",
      //             insertAsstMsgError.message
      //           )
      //         } else {
      //           console.log(
      //             "✅ Assistant message saved to DB (Mobile client)."
      //           )
      //         }
      //       } catch (e: any) {
      //         console.error(
      //           "❌ EXCEPTION saving assistant message:",
      //           e.message
      //         )
      //       }
      //     } else {
      //       console.warn(
      //         "⚠️ Assistant response was empty, not saving to DB."
      //       )
      //     }
      //   } else {
      //     console.log(
      //       "DEBUG: Skipping assistant message save (Web client will save)."
      //     )
      //   }

      // بازگرداندن Stream به کلاینت
      // بازگرداندن Stream به کلاینت
      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no"
        }
      })
    } else {
      const isNewOpenAIModel = [
        "gpt-5",
        "gpt-5-mini",
        "gpt-5-nano",
        "gpt-5-codex"
      ].includes(selectedModel)
      const userInputText = finalMessages
        .map(m =>
          typeof m.content === "string"
            ? m.content
            : extractTextFromContent(m.content)
        )
        .join("\n")
      if (isNewOpenAIModel) {
        // ✅ مدل جدید: از v1/responses استفاده می‌کنیم
        const response = await openai.responses.create({
          model: selectedModel,
          input: userInputText,
          temperature: temp,
          max_output_tokens: maxTokens,
          ...(MODELS_WITH_PRIORITY_TIER.has(selectedModel)
            ? { service_tier: "default" }
            : {})
        })
        console.log(
          "🚀 [PRIORITY-CHECK] Non-Stream Response Payload (v1/responses):",
          JSON.stringify(response, null, 2)
        )
        const content = response.output_text ?? ""
        return new Response(content, {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        })
      } else {
        // ✅ مدل قدیمی: از chat.completions.create استفاده می‌کنیم
        try {
          const payload: ChatCompletionCreateParams = {
            model: selectedModel,
            messages: finalMessages,
            stream: false,
            temperature: temp,
            user: userId
          }
          if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
            ;(payload as any).max_completion_tokens = maxTokens
          } else {
            payload.max_tokens = maxTokens
          }
          if (MODELS_WITH_PRIORITY_TIER.has(selectedModel)) {
            ;(payload as any).service_tier = "default"
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
              await supabaseAdmin.rpc("deduct_credits_and_log_usage", {
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
        } catch (error: any) {
          // ⬅️ جابجایی 1: بلاک CATCH به اینجا منتقل شد (داخل ELSE)
          // ⬅️ اکنون این 'catch' معتبر است
          console.error("!!! FULL BACKEND ERROR CATCH !!!:", error)
          const errorMessage = error.message || "یک خطای غیرمنتظره رخ داد"
          const status = error.status || 500
          return NextResponse.json({ message: errorMessage }, { status })
        }
      } // (خط 1082 در کد اصلی) - این آکولاد، ELSE مدل قدیمی را می‌بندد
    } // (خط 1090 در کد اصلی) - این آکولاد، ELSE غیر استریم را می‌بندد
  } catch (error: any) {
    // (خط 1093 در کد اصلی) - این CATCH اصلی است
    // (خط 1092 در کد اصلی) ⬅️ جابجایی 2: آکولاد اضافه در اینجا حذف شد
    // ⬅️ اکنون این 'catch' معتبر است
    console.error("!!! FULL BACKEND ERROR CATCH !!!:", error)
    const errorMessage = error.message || "یک خطای غیرمنتظره رخ داد"
    const status = error.status || 500
    return NextResponse.json({ message: errorMessage }, { status })
  }
}
