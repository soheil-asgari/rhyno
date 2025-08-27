import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import type {
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming
} from "openai/resources/chat/completions"
import { NextResponse } from "next/server"
import { MODEL_PROMPTS } from "@/lib/build-prompt"

export const runtime: ServerRuntime = "edge"

type ExtendedChatSettings = ChatSettings & {
  maxTokens?: number
  max_tokens?: number
}

// تعریف Setها برای مدل‌های مختلف
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
  try {
    const { chatSettings, messages, enableWebSearch } = await request.json()

    const profile = await getServerProfile()
    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const selectedModel = chatSettings.model || "gpt-4o-mini"

    // هدایت درخواست‌های DALL-E 3 به /api/dalle
    if (selectedModel === "dall-e-3") {
      return NextResponse.json(
        { message: "DALL-E 3 requests should be sent to /api/dalle/route.ts" },
        { status: 400 }
      )
    }

    // ✅ منطق برای مدل‌های Realtime با مدیریت خطای اصولی
    if (selectedModel.includes("realtime")) {
      console.log(`Creating realtime session for model: ${selectedModel}`)

      // مستقیم از MODEL_PROMPTS بخون
      const systemPrompt =
        MODEL_PROMPTS[selectedModel] ?? "You are Rhyno realtime assistant."

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
              "You are Rhyno realtime assistant. Use the web_search function when needed.",
            tools: [
              {
                type: "function",
                name: "web_search",
                description: "Search the web for up-to-date information",
                parameters: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description: "The search query to look up online"
                    }
                  },
                  required: ["query"]
                }
              }
            ]
          })
        }
      )

      // ✨ اصلاح کلیدی: اگر OpenAI خطا برگرداند، آن را مدیریت کن
      if (!response.ok) {
        const errorBody = await response.json()
        console.error("Error creating OpenAI realtime session:", errorBody)
        // پرتاب خطا باعث می‌شود که به بلاک catch اصلی برویم و پاسخ خطای استاندارد ارسال شود
        throw new Error(
          errorBody.error?.message || "Failed to create realtime session"
        )
      }

      const session = await response.json()
      return NextResponse.json(session)
    }

    // منطق برای مدل‌های غیر DALL-E 3
    const cs = chatSettings as ExtendedChatSettings
    const maxTokens = pickMaxTokens(cs)

    let enableSearch: boolean
    if (typeof enableWebSearch === "boolean") {
      enableSearch = enableWebSearch
    } else {
      enableSearch = MODELS_WITH_AUTO_SEARCH.has(selectedModel)
    }

    const temp =
      typeof cs.temperature === "number"
        ? cs.temperature
        : ["gpt-4o", "gpt-4o-mini", "gpt-5", "gpt-5-mini"].includes(
              selectedModel
            )
          ? 1
          : 0.7

    const useStream = !MODELS_THAT_SHOULD_NOT_STREAM.has(selectedModel)
    const useOpenAIWebSearch =
      !!enableSearch && MODELS_WITH_OPENAI_WEB_SEARCH.has(selectedModel)

    if (useOpenAIWebSearch) {
      // اگر مدل gpt-5 یا gpt-5-mini باشه → استریم نکن
      if (["gpt-5", "gpt-5-mini"].includes(selectedModel)) {
        const response = await openai.responses.create({
          model: selectedModel,
          input: messages.map((m: any) =>
            m.role === "user"
              ? {
                  role: "user",
                  content: [{ type: "input_text", text: m.content }]
                }
              : m
          ),
          tools: [{ type: "web_search" as any }],
          temperature: temp,
          max_output_tokens: maxTokens
        })

        return new Response(response.output_text ?? "", {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        })
      }

      // برای مدل‌های دیگه (مثلاً gpt-4o) همچنان استریم کن
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const transformedInput = (messages ?? []).map((m: any) => {
              if (m.role === "user") {
                return {
                  ...m,
                  content: [{ type: "input_text", text: m.content }]
                }
              }
              if (m.role === "assistant" && typeof m.content === "string") {
                return {
                  ...m,
                  content: [{ type: "output_text", text: m.content }]
                }
              }
              return m
            })

            const oaiStream = await openai.responses.stream({
              model: selectedModel,
              input: transformedInput,
              tools: [{ type: "web_search" as any }], // 👈 تغییر به web_search
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

    if (useStream) {
      console.log(`📡 Model "${selectedModel}" is using streaming.`)
      const payload: ChatCompletionCreateParamsStreaming = {
        model: selectedModel,
        messages,
        stream: true,
        temperature: temp,
        presence_penalty: 0,
        frequency_penalty: 0,
        max_tokens: maxTokens
      }

      if (MODELS_NEED_MAX_COMPLETION.has(selectedModel)) {
        ;(payload as any).max_completion_tokens = maxTokens
      } else {
        payload.max_tokens = maxTokens
      }

      const stream = await openai.chat.completions.create(payload)

      return new Response(stream.toReadableStream(), {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no"
        }
      })
    } else {
      const payload: ChatCompletionCreateParams = {
        model: selectedModel,
        messages,
        stream: false,
        temperature: temp,
        presence_penalty: 0,
        frequency_penalty: 0
      }

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
    const errorMessage = error.message || "یک خطای غیرمنتظره رخ داد"
    const status = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: status,
      headers: { "Content-Type": "application/json" }
    })
  }
}
