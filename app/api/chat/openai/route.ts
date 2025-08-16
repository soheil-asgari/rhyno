import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions"

export const runtime: ServerRuntime = "edge"

type ExtendedChatSettings = ChatSettings & {
  maxTokens?: number
  max_tokens?: number
}

const MODELS_NEED_MAX_COMPLETION = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-5",
  "gpt-5-mini"
])

// مدل‌هایی که «وب‌سرچ داخلی OpenAI» را پشتیبانی می‌کنند
const MODELS_WITH_OPENAI_WEB_SEARCH = new Set(["gpt-4o", "gpt-4o-mini"])

// اگر کاربر سوییچ رو نگفته بود، برای این مدل‌ها وب‌سرچ را خودکار فعال کن
const MODELS_WITH_AUTO_SEARCH = new Set(["gpt-4o", "gpt-4o-mini"])

function pickMaxTokens(cs: ExtendedChatSettings): number {
  return Math.min(cs.maxTokens ?? cs.max_tokens ?? 600, 1200)
}

export async function POST(request: Request) {
  const { chatSettings, messages, enableWebSearch } = await request.json()

  // تعیین وضعیت نهایی وب‌سرچ
  // تعیین وضعیت نهایی وب‌سرچ
  let enableSearch: boolean

  if (typeof enableWebSearch === "boolean") {
    enableSearch = enableWebSearch // دقیقا boolean واقعی
  } else if (enableWebSearch !== undefined) {
    // اگر به صورت string "true"/"false" اومده باشه
    enableSearch = String(enableWebSearch).toLowerCase() === "true"
  } else {
    // اگر اصلا نیومده بود
    enableSearch = MODELS_WITH_AUTO_SEARCH.has(chatSettings?.model)
  }

  try {
    // auth
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

    // اگر وب‌سرچ روشن است و مدل از ابزار web_search پشتیبانی می‌کند: مسیر Responses API + وب‌سرچ
    const useOpenAIWebSearch =
      !!enableSearch && MODELS_WITH_OPENAI_WEB_SEARCH.has(selectedModel)

    if (useOpenAIWebSearch) {
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        async start(controller) {
          console.log("🔍 وب‌سرچ فعال است:", enableSearch) // لاگ وضعیت وب‌سرچ

          try {
            // به فرمت سادهٔ چند-پیامی برای Responses API
            const input = (messages ?? []).map((m: any) => ({
              role: m.role,
              content: m.content
            }))

            // Streaming با ابزار داخلی وب‌سرچ
            const oaiStream = await openai.responses.stream({
              model: selectedModel, // gpt-4o-mini
              input,
              tools: [{ type: "web_search_preview" }],
              temperature: temp,
              max_output_tokens: maxTokens
            })

            let firstChunkSent = false

            // رویدادهای Responses API
            for await (const event of oaiStream as AsyncIterable<any>) {
              if (event.type === "response.output_text.delta") {
                // فقط اولین بار می‌تونی یه پیام موقت نشون بدی
                if (!firstChunkSent) {
                  // اینجا می‌تونی پیام موقت بفرستی بعدش پاک کنی
                  // controller.enqueue(encoder.encode("⌛ در حال جست‌وجوی وب...\n"));
                  // و بلافاصله بعدش اولین پاسخ واقعی میاد، جایگزین میشه
                  firstChunkSent = true
                }
                controller.enqueue(encoder.encode(String(event.delta || "")))
              } else if (event.type === "response.error" && "error" in event) {
                const msg = String(event.error?.message || "خطای ناشناخته")
                controller.enqueue(encoder.encode(`\n❌ ${msg}`))
              }
            }
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(`❌ خطا: ${err?.message || "خطای ناشناخته"}`)
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

    // در غیر این‌صورت: مسیر معمول Chat Completions (بدون وب‌سرچ)
    const basePayload: ChatCompletionCreateParamsStreaming = {
      model: selectedModel,
      messages,
      stream: true,
      temperature: temp,
      presence_penalty: 0,
      frequency_penalty: 0
    }

    if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
      ;(basePayload as any).max_completion_tokens = maxTokens
    } else {
      ;(basePayload as any).max_tokens = maxTokens
    }

    try {
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        async start(controller) {
          // پیام "در حال پردازش پاسخ..." را فقط برای مدت کوتاهی نمایش می‌دهیم
          // controller.enqueue(encoder.encode("⌛ در حال پردازش پاسخ...\n"))

          try {
            const response = await openai.chat.completions.create({
              ...basePayload,
              stream: true
            })

            // وقتی پردازش تمام شد، پیام "در حال پردازش" حذف می‌شود و محتوا به کاربر ارسال می‌شود
            for await (const chunk of response) {
              const content = chunk.choices[0]?.delta?.content
              if (content) controller.enqueue(encoder.encode(content))
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
    } catch (streamErr: any) {
      // fallback غیر استریم
      const nonStreamPayload: any = {
        model: selectedModel,
        messages,
        temperature: temp,
        presence_penalty: 0,
        frequency_penalty: 0
      }
      if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
        nonStreamPayload.max_completion_tokens = maxTokens
      } else {
        nonStreamPayload.max_tokens = maxTokens
      }

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode("در حال پردازش...\n"))
          try {
            const res = await openai.chat.completions.create(nonStreamPayload)
            const content = res.choices?.[0]?.message?.content ?? ""
            controller.enqueue(encoder.encode(content))
          } catch (e: any) {
            controller.enqueue(
              encoder.encode(`Error: ${e?.message || "Unexpected error"}`)
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
  } catch (error: any) {
    return new Response(
      JSON.stringify({ message: error?.message || "Unexpected error" }),
      {
        status: error?.status || 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
