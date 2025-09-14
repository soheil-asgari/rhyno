// 📁 app/api/chat/mcp/route.ts

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import OpenAI from "openai"
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam
} from "openai/resources/chat/completions"

// --- Your Helper Functions ---
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings, LLMID } from "@/types"
import { OPENAI_LLM_LIST } from "@/lib/models/llm/openai-llm-list"
import { modelsWithRial } from "@/app/checkout/pricing"
export const runtime = "nodejs"

function safeJSONParse(jsonString: string | undefined): any {
  if (!jsonString) return {}
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    console.warn("JSON.parse failed, attempting to fix string:", jsonString)
    try {
      const fixedString = jsonString
        .replace(/(?<!\\)'/g, '"')
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
        .replace(/,\s*([}\]])/g, "$1")
      return JSON.parse(fixedString)
    } catch (finalError) {
      console.error("Critical JSON parse error after fix:", finalError)
      return {}
    }
  }
}
type ExtendedChatSettings = ChatSettings & {
  maxTokens?: number
  max_tokens?: number
}
const pricingMap = new Map(
  OPENAI_LLM_LIST.map(llm => [llm.modelId, llm.pricing])
)
const PROFIT_MARGIN = 1.4

function calculateUserCostUSD(
  modelId: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
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
const MODEL_MAX_TOKENS: Record<string, number> = {
  "gpt-4o": 8192,
  "gpt-4o-mini": 4096,
  "gpt-5": 12000,
  "gpt-5-mini": 12000
}
function pickMaxTokens(cs: ExtendedChatSettings, modelId: string): number {
  const requestedTokens = cs.maxTokens ?? cs.max_tokens ?? 4096
  const modelLimit = MODEL_MAX_TOKENS[modelId] ?? 4096
  return Math.min(requestedTokens, modelLimit)
}

export async function POST(request: Request) {
  console.log("✅ درخواست به مسیر MCP دریافت شد.")
  try {
    const contentType = request.headers.get("Content-Type") || ""
    let chatSettings: ChatSettings
    let messages: ChatCompletionMessageParam[]
    let file: File | null = null

    if (contentType.includes("multipart/form-data")) {
      console.log("در حال پردازش درخواست multipart/form-data...")
      const formData = await request.formData()
      chatSettings = JSON.parse(formData.get("chatSettings") as string)
      messages = JSON.parse(formData.get("messages") as string)
      file = formData.get("file") as File | null
    } else if (contentType.includes("application/json")) {
      console.log("در حال پردازش درخواست application/json...")
      const body = await request.json()
      chatSettings = body.chatSettings
      messages = body.messages
    } else {
      return new NextResponse(`Unsupported Content-Type: ${contentType}`, {
        status: 415
      })
    }

    const fileServerUrl =
      process.env.FILE_SERVER_URL || "http://65.109.206.118:3000"

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

    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single()
    if (!wallet || wallet.balance <= 0) {
      return NextResponse.json(
        { message: "موجودی شما کافی نیست." },
        { status: 402 }
      )
    }

    const profile = await getServerProfile()
    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const selectedModel = "gpt-5-nano" as LLMID

    if (file) {
      const fileBuffer = Buffer.from(await file.arrayBuffer())
      const base64Image = fileBuffer.toString("base64")
      const mimeType = file.type
      const lastUserMessage = messages[messages.length - 1]
      if (lastUserMessage && lastUserMessage.role === "user") {
        const newContent: any[] = []
        if (
          lastUserMessage.content &&
          typeof lastUserMessage.content === "string"
        ) {
          newContent.push({ type: "text", text: lastUserMessage.content })
        }
        newContent.push({
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64Image}` }
        })
        lastUserMessage.content = newContent
      }
    }

    // ✅✅✅ FINAL AND CORRECTED TOOL DEFINITIONS ✅✅✅
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "generate_pdf",
          description: "یک فایل PDF با یک عنوان و یک متن محتوا ایجاد می‌کند.",
          parameters: {
            type: "object",
            properties: {
              filename: {
                type: "string",
                description: "نام فایل. مثال: report.pdf"
              },
              title: {
                type: "string",
                description:
                  "عنوان اصلی فایل که با فونت بزرگ و وسط‌چین نمایش داده می‌شود."
              },
              content: {
                type: "string",
                description:
                  "محتوای اصلی فایل که با فونت کوچک‌تر نمایش داده می‌شود."
              },
              titleFontSize: {
                type: "number",
                description: "اندازه فونت برای عنوان. پیش‌فرض: 25"
              },
              contentFontSize: {
                type: "number",
                description: "اندازه فونت برای محتوا. پیش‌فرض: 14"
              }
            },
            required: ["filename"]
          }
        }
      },

      {
        type: "function",
        function: {
          name: "generate_word",
          description:
            "یک فایل Word (.docx) با عنوان و محتوای مشخص ایجاد می‌کند.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "عنوان اصلی فایل Word" },
              content: { type: "string", description: "محتوای اصلی فایل Word" },
              filename: {
                type: "string",
                description: "نام فایل. مثال: document.docx"
              }
            },
            required: ["filename"]
          }
        }
      },

      // Replace the generate_excel tool definition in route.ts with this

      {
        type: "function",
        function: {
          name: "generate_excel",
          description:
            "یک فایل Excel (.xlsx) حرفه‌ای با داده‌های مشخص، استایل و فرمول‌های داینامیک ایجاد می‌کند.",
          parameters: {
            type: "object",
            properties: {
              filename: {
                type: "string",
                description: "نام فایل خروجی. مثال: report.xlsx"
              },
              sheetNames: {
                type: "array",
                description: "آرایه‌ای از نام شیت‌ها.",
                items: { type: "string" }
              },
              headers: {
                type: "array",
                description:
                  "آرایه‌ای از نام ستون‌ها که در ردیف اول قرار می‌گیرد.",
                items: { type: "string" }
              },
              data: {
                type: "array",
                description:
                  "داده‌های واقعی برای پر کردن شیت. آرایه‌ای از ردیف‌ها است که هر ردیف خود یک آرایه از مقادیر سلول‌هاست. مثال: [['کالای اول', 10], ['کالای دوم', 25]]",
                items: {
                  type: "array",
                  items: {
                    anyOf: [{ type: "string" }, { type: "number" }]
                  }
                }
              },
              formulas: {
                type: "array",
                description: "آرایه‌ای از فرمول‌ها برای اعمال به شیت.",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["SUM"],
                      description: "نوع فرمول."
                    },
                    columnHeader: {
                      type: "string",
                      description: "نام ستونی که باید جمع زده شود."
                    },
                    label: {
                      type: "string",
                      description: "برچسب برای سلول جمع کل."
                    },
                    labelColumnHeader: {
                      type: "string",
                      description: "نام ستونی که برچسب در آن قرار می‌گیرد."
                    }
                  }
                }
              },
              conditionalFormatting: {
                type: "array",
                description: "آرایه‌ای از قوانین فرمت‌دهی شرطی.",
                items: {
                  type: "object",
                  properties: {
                    columnHeader: {
                      type: "string",
                      description: "نام ستونی که قانون روی آن اعمال می‌شود."
                    },
                    type: {
                      type: "string",
                      enum: ["greaterThan", "lessThan"],
                      description: "نوع شرط."
                    },
                    value: {
                      type: "number",
                      description: "مقدار برای مقایسه."
                    },
                    color: {
                      type: "string",
                      description:
                        "کد هگز رنگ برای هایلایت. مثال: 'FFFF0000' برای قرمز."
                    }
                  }
                }
              }
            },
            required: ["filename", "headers"]
          }
        }
      }
    ]

    const finalMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "شما یک دستیار هوش مصنوعی پیشرفته و چندوجهی (multi-modal) هستید که فقط به زبان فارسی پاسخ می‌دهید. وظیفه شما اجرای دقیق ابزارها بر اساس درخواست متنی و تصویری کاربر است. اگر کاربر تصویری ارسال کرد، از قابلیت‌های بینایی خود برای تحلیل آن استفاده کن و اطلاعات استخراج شده را مستقیماً به پارامترهای ابزار مناسب (مانند پارامتر `data` در ابزار اکسل) ارسال کن. همیشه ابزارها را مستقیماً و بدون سوال تاییدی فراخوانی کن."
      },
      ...messages
    ]

    const cs = chatSettings as ExtendedChatSettings
    const maxTokens = pickMaxTokens(cs, selectedModel)
    const temp = typeof cs.temperature === "number" ? cs.temperature : 1
    let usage:
      | {
          prompt_tokens: number
          completion_tokens: number
          total_tokens?: number
        }
      | undefined

    const payload: ChatCompletionCreateParamsStreaming = {
      model: selectedModel,
      messages: finalMessages,
      stream: true,
      temperature: temp,
      tools: tools,
      tool_choice: "auto",
      ...(MODELS_NEED_MAX_COMPLETION.has(selectedModel)
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens })
    }

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = await openai.chat.completions.create(payload)

          let hasToolCall = false
          const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] =
            []

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta

            if (delta?.content) {
              controller.enqueue(encoder.encode(delta.content))
            }
            if (chunk.usage) {
              usage = {
                prompt_tokens: chunk.usage.prompt_tokens,
                completion_tokens: chunk.usage.completion_tokens,
                total_tokens: chunk.usage.total_tokens
              }
            }

            if (delta?.tool_calls) {
              hasToolCall = true
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index
                if (!toolCalls[index]) {
                  toolCalls[index] = {
                    id: "",
                    type: "function",
                    function: { name: "", arguments: "" }
                  }
                }
                const currentTool = toolCalls[index]
                if (currentTool.type === "function") {
                  if (toolCallDelta.id) currentTool.id = toolCallDelta.id
                  if (toolCallDelta.function?.name)
                    currentTool.function.name = toolCallDelta.function.name
                  if (toolCallDelta.function?.arguments)
                    currentTool.function.arguments +=
                      toolCallDelta.function.arguments
                }
              }
            }
          }
          if (!usage) {
            console.log(
              "⚠️ No usage from stream. Using fallback non-stream request for cost calculation."
            )
            const fallbackResponse = await openai.chat.completions.create({
              model: selectedModel,
              messages: finalMessages,
              temperature: temp,
              stream: false
            })
            if (fallbackResponse.usage) {
              usage = {
                prompt_tokens: fallbackResponse.usage.prompt_tokens,
                completion_tokens: fallbackResponse.usage.completion_tokens,
                total_tokens: fallbackResponse.usage.total_tokens
              }

              // 🔥 Log AFTER usage is available
              console.log(
                `💰 [BEFORE DEDUCT] User ${user.id} balance: ${wallet.balance}, cost to deduct: $${calculateUserCostUSD(selectedModel, usage)}`
              )
            }
          }

          if (hasToolCall) {
            const newMessages: ChatCompletionMessageParam[] = [
              ...finalMessages,
              { role: "assistant", tool_calls: toolCalls }
            ]
            for (const toolCall of toolCalls) {
              if (toolCall.type === "function") {
                const functionName = toolCall.function.name
                const functionArgs = safeJSONParse(toolCall.function.arguments)
                const apiResponse = await fetch(
                  `${fileServerUrl}/tools/${functionName}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(functionArgs)
                  }
                )
                if (!apiResponse.ok) {
                  throw new Error(
                    `Error from file server: ${await apiResponse.text()}`
                  )
                }
                const result = await apiResponse.json()
                newMessages.push({
                  tool_call_id: toolCall.id,
                  role: "tool",
                  content: JSON.stringify(result)
                })
              }
            }
            const finalStream = await openai.chat.completions.create({
              model: selectedModel,
              messages: newMessages,
              stream: true
            })
            for await (const finalChunk of finalStream) {
              const content = finalChunk.choices[0]?.delta?.content || ""
              if (content) {
                controller.enqueue(encoder.encode(content))
              }
            }
            // اگر usage نیامد، fallback بزن
            if (usage && wallet) {
              const userCostUSD = calculateUserCostUSD(selectedModel, usage)
              if (userCostUSD > 0) {
                await supabase.rpc("deduct_credits_and_log_usage", {
                  p_user_id: user.id,
                  p_model_name: selectedModel,
                  p_prompt_tokens: usage.prompt_tokens,
                  p_completion_tokens: usage.completion_tokens,
                  p_cost: userCostUSD
                })

                const { data: newWallet, error } = await supabase
                  .from("wallets")
                  .select("balance")
                  .eq("user_id", user.id)
                  .single()

                if (error)
                  console.error("❌ Error fetching new balance:", error)
                else
                  console.log(
                    `✅ [AFTER DEDUCT] User ${user.id} new balance: ${newWallet.balance}`
                  )
              }
            }
          }
        } catch (err: any) {
          console.error("❌ ERROR INSIDE MCP STREAM:", err)
          controller.enqueue(encoder.encode(`خطای سرور: ${err.message}`))
        } finally {
          controller.close()
        }
      }
    })
    return new Response(readableStream, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" }
    })
  } catch (error: any) {
    console.error("!!! MCP ROUTE ERROR CATCH !!!:", error)
    const errorMessage = error.message || "یک خطای غیرمنتظره در مسیر MCP رخ داد"
    const status = error.status || 500
    return NextResponse.json({ message: errorMessage }, { status })
  }
}
