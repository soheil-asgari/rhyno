import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import type {
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions"

export const runtime: ServerRuntime = "edge"

type ExtendedChatSettings = ChatSettings & {
  maxTokens?: number
  max_tokens?: number
}

// مدل‌هایی که نیازمند max_completion_tokens هستند
const MODELS_NEED_MAX_COMPLETION = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-5",
  "gpt-5-mini"
])

// مدل‌هایی که «وب‌سرچ داخلی OpenAI» را پشتیبانی می‌کنند
const MODELS_WITH_OPENAI_WEB_SEARCH = new Set(["gpt-4o", "gpt-4o-mini"])
// مدل‌هایی که برای استریم نیاز به تایید سازمان دارند (و باید غیر استریم ارسال شوند)
const MODELS_THAT_SHOULD_NOT_STREAM = new Set(["gpt-4", "gpt-5"])
// اگر کاربر سوییچ رو نگفته بود، برای این مدل‌ها وب‌سرچ را خودکار فعال کن
const MODELS_WITH_AUTO_SEARCH = new Set(["gpt-4o", "gpt-4o-mini"])

function pickMaxTokens(cs: ExtendedChatSettings): number {
  return Math.min(cs.maxTokens ?? cs.max_tokens ?? 10000, 12000)
}

export async function POST(request: Request) {
  try {
    const { chatSettings, messages, enableWebSearch } = await request.json()

    // تعیین وضعیت نهایی وب‌سرچ
    let enableSearch: boolean
    if (typeof enableWebSearch === "boolean") {
      enableSearch = enableWebSearch
    } else {
      enableSearch = MODELS_WITH_AUTO_SEARCH.has(chatSettings?.model)
    }

    // --- بخش احراز هویت و تنظیمات اولیه ---
    const profile = await getServerProfile()
    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const cs = chatSettings as ExtendedChatSettings
    const selectedModel = cs.model || "gpt-4o-mini"
    const maxTokens = pickMaxTokens(cs)

    const temp =
      typeof cs.temperature === "number"
        ? cs.temperature
        : [
              "gpt-4-vision-preview",
              "gpt-4o",
              "gpt-4o-mini",
              "gpt-5",
              "gpt-5-mini"
            ].includes(selectedModel)
          ? 1
          : 0.7

    // --- تصمیم‌گیری برای استریم کردن ---
    // اگر مدل در لیست مدل‌های غیر استریم باشد، این متغیر false خواهد شد.
    const useStream = !MODELS_THAT_SHOULD_NOT_STREAM.has(selectedModel)

    // --- منطق وب‌سرچ ---
    const useOpenAIWebSearch =
      !!enableSearch && MODELS_WITH_OPENAI_WEB_SEARCH.has(selectedModel)
    if (selectedModel === "dall-e-3") {
      const inputText = messages[0].content // فرض بر این است که پیام ورودی متن توصیفی است
      console.log("Input Text for DALL·E 3:", inputText) // لاگ ورودی

      try {
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: inputText,
          n: 1, // تعداد تصاویر تولیدی
          size: "1024x1024" // اندازه تصویر
        })

        console.log("Image Response:", imageResponse) // لاگ پاسخ تصویر

        const imageUrl = imageResponse?.data?.[0]?.url // URL تصویر تولید شده

        if (imageUrl) {
          return new Response(JSON.stringify({ imageUrl }), {
            headers: {
              "Content-Type": "application/json"
            }
          })
        } else {
          throw new Error("Image URL not found in the response")
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("Error generating image:", error.message) // لاگ خطا
          return new Response(JSON.stringify({ message: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          })
        } else {
          console.error("Unexpected error:", error) // خطای غیرمنتظره
          return new Response(
            JSON.stringify({ message: "Unexpected error occurred" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          )
        }
      }
    }

    if (useOpenAIWebSearch) {
      // این بخش همیشه استریم است چون API مخصوص به خود را دارد
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const input = (messages ?? []).map((m: any) => ({
              role: m.role,
              content: m.content
            }))

            const oaiStream = await openai.responses.stream({
              model: selectedModel,
              input,
              tools: [{ type: "web_search_preview" }],
              temperature: temp,
              max_output_tokens: maxTokens
            })

            for await (const event of oaiStream as AsyncIterable<any>) {
              if (event.type === "response.output_text.delta") {
                controller.enqueue(encoder.encode(String(event.delta || "")))
              } else if (event.type === "response.error" && "error" in event) {
                const msg = String(event.error?.message || "خطای ناشناخته")
                controller.enqueue(encoder.encode(`\n❌ ${msg}`))
              }
            }
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(
                `❌ خطا در وب‌سرچ: ${err?.message || "خطای ناشناخته"}`
              )
            )
          } finally {
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

    // --- تغییر اصلی: جدا کردن منطق استریم و غیر استریم ---
    if (useStream) {
      // *** مسیر استریم برای مدل‌های مجاز ***
      const payload: ChatCompletionCreateParamsStreaming = {
        model: selectedModel,
        messages,
        stream: true, // استریم فعال است
        temperature: temp,
        max_tokens: maxTokens,
        presence_penalty: 0,
        frequency_penalty: 0
      }

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const response = await openai.chat.completions.create(payload)

            for await (const chunk of response) {
              const content = chunk.choices[0]?.delta?.content
              if (content) {
                controller.enqueue(encoder.encode(content))
              }
            }
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(`❌ خطا: ${err.message || "خطای ناشناخته"}`)
            )
          } finally {
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
    } else {
      // *** مسیر غیر استریم برای مدل‌هایی که نباید استریم شوند ***
      const payload: ChatCompletionCreateParams = {
        model: selectedModel,
        messages,
        stream: false, // استریم غیرفعال است
        temperature: temp,
        presence_penalty: 0,
        frequency_penalty: 0
      }

      // تعیین max_tokens بر اساس نوع مدل
      if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
        ;(payload as any).max_completion_tokens = maxTokens
      } else {
        payload.max_tokens = maxTokens
      }

      const response = await openai.chat.completions.create(payload)
      const content = response.choices[0].message.content ?? ""

      return new Response(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      })
    }
  } catch (error: any) {
    console.error("!!! FULL BACKEND ERROR CATCH !!!:", error)
    // مدیریت خطاهای کلی مانند JSON نامعتبر یا مشکلات احراز هویت
    const errorMessage = error.message || "یک خطای غیرمنتظره رخ داد"
    const status = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: status,
      headers: { "Content-Type": "application/json" }
    })
  }
}
