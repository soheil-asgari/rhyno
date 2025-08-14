// app/api/chat/route.ts

import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { z } from "zod"
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions"

// ---------------------- تنظیمات ----------------------
export const runtime: ServerRuntime = "edge"

// ---------------------- وب‌سرچ (Tavily) ----------------------

const TAVILY_API_KEY = process.env.TAVILY_API_KEY // دریافت کلید API از متغیر محیطی

type WebResult = {
  title: string
  url: string
  snippet: string
}

async function webSearch(
  queries: string[],
  enableWebSearch: boolean,
  lastUserMessage?: string
): Promise<WebResult[]> {
  console.log("🌐 Tavily Search - queries:", queries)

  // اگر وب‌سرچ غیرفعال است، جستجو را انجام نده
  if (!enableWebSearch) {
    console.warn("⚠️ Web search is disabled.")
    return []
  }

  // بررسی که آیا کلید API موجود است یا خیر
  if (!TAVILY_API_KEY) {
    console.warn("⚠️ Tavily API Key not set")
    return []
  }

  // اگر کوئری خالی بود از پیام کاربر استفاده کن
  if (!queries?.length && lastUserMessage) {
    queries = [lastUserMessage]
  }

  const q = (queries ?? []).filter(Boolean).join(" | ").trim()
  if (!q) {
    console.warn("⚠️ Empty query after fallback, skipping Tavily search.")
    return []
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": TAVILY_API_KEY // استفاده از کلید API از process.env
      },
      body: JSON.stringify({
        query: q,
        max_results: 5,
        include_images: false,
        include_answer: false,
        include_raw_content: false,
        search_depth: "basic"
      })
    })

    if (!res.ok) {
      const txt = await res.text()
      console.error(
        "❌ Tavily response error:",
        res.status,
        res.statusText,
        txt
      )
      return []
    }

    const data: any = await res.json()
    console.log("🔎 Tavily API response data:", data)

    const out: WebResult[] = (data.results ?? []).map((r: any) => ({
      title: String(r?.title ?? ""),
      url: String(r?.url ?? ""),
      snippet: String(r?.content ?? r?.snippet ?? "")
    }))

    console.log(`🔎 Tavily results: ${out.length}`)
    return out
  } catch (err) {
    console.error("❌ Tavily search exception:", err)
    return []
  }
}

// ---------------------- ثابت‌ها/ابزارها ----------------------
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
const MODELS_WITH_AUTO_SEARCH = new Set(["gpt-4o", "gpt-4o-mini"])

function pickMaxTokens(cs: ExtendedChatSettings): number {
  return Math.min(cs.maxTokens ?? cs.max_tokens ?? 600, 1200)
}

// ---------------------- هندلر اصلی ----------------------
export async function POST(request: Request) {
  const { chatSettings, messages, enableWebSearch } = await request.json()

  // ✅ اگر مدل gpt-4o یا gpt-4o-mini انتخاب شد، وب‌سرچ را خودکار فعال کن
  let enableSearch = enableWebSearch
  if (
    enableSearch === undefined &&
    MODELS_WITH_AUTO_SEARCH.has(chatSettings?.model)
  ) {
    enableSearch = true
  }

  console.log("📥 Incoming body:", {
    chatSettings,
    enableWebSearch: enableSearch
  })

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

    console.log(
      `🤖 Model: ${selectedModel} | maxTokens: ${maxTokens} | temp: ${temp}`
    )

    // ---------------------- مرحله وب‌سرچ ----------------------
    const augmentedMessages = [...messages] // Clone messages to avoid mutation
    const WebQuerySchema = z.object({
      queries: z.array(z.string()).max(3) // حداکثر 3 کوئری مجاز
    })
    if (enableSearch) {
      try {
        console.log("🔍 Planning queries with gpt-4o-mini...")

        const encoder = new TextEncoder()
        // Step 1: Query Planning using GPT
        const planning = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          stream: false,
          temperature: 0,
          max_tokens: 150,
          messages: [
            {
              role: "system",
              content: 'Return JSON {"queries": []} with max 3 items.'
            },
            {
              role: "user",
              content: messages?.[messages.length - 1]?.content || ""
            }
          ]
        })

        const txt = planning.choices?.[0]?.message?.content ?? "{}"
        let queries: string[] = []
        try {
          queries = WebQuerySchema.parse(JSON.parse(txt)).queries
        } catch (err) {
          console.warn(
            "⚠️ Planning JSON parse failed, fallback to user text:",
            err
          )
          queries = [messages?.[messages.length - 1]?.content ?? ""].filter(
            Boolean
          )
        }

        // Step 2: Perform Web Search
        const webResults = await webSearch(queries, enableWebSearch)
        if (webResults.length) {
          const ctx = webResults
            .map((it, i) => `[${i + 1}] ${it.title}\n${it.url}\n${it.snippet}`)
            .join("\n\n")
          augmentedMessages.unshift({
            role: "system",
            content: `Use the following web results as context. Cite with [1], [2], ... by index.\n\n${ctx}`
          })
        } else {
          console.warn("⚠️ No web results, continuing without extra context.")
        }
      } catch (err) {
        console.error("❌ Web search step failed:", err)
      }
    }

    // ---------------------- ساخت payload استریم ----------------------
    const basePayload: ChatCompletionCreateParamsStreaming = {
      model: selectedModel,
      messages: augmentedMessages,
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

    console.log("💬 Final payload:", {
      ...basePayload,
      messagesCount: Array.isArray(messages) ? messages.length : 0
    })

    // ---------------------- ارسال و استریم ----------------------
    try {
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode("⌛ در حال پردازش پاسخ...\n"))

          try {
            const response = await openai.chat.completions.create({
              ...basePayload,
              stream: true
            })

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
    } catch (streamErr: any) {
      console.error("❌ OpenAI streaming failed, falling back:", streamErr)

      const nonStreamPayload: any = {
        model: selectedModel,
        messages: augmentedMessages,
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
    console.error("❌ Fatal error:", error)
    return new Response(
      JSON.stringify({ message: error?.message || "Unexpected error" }),
      {
        status: error?.status || 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
