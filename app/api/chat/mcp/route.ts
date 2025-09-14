// 📁 app/api/chat/mcp/route.ts

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import OpenAI from "openai"
import type {
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam
} from "openai/resources/chat/completions"
import { MODEL_PROMPTS } from "@/lib/build-prompt"
// --- توابع کمکی و ثابت‌ها ---
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings, LLMID } from "@/types"
import { OPENAI_LLM_LIST } from "@/lib/models/llm/openai-llm-list"

export const runtime = "nodejs"

// --- تابع کمکی برای پردازش امن JSON ---
function safeJSONParse(jsonString: string | undefined): any {
  if (!jsonString) return {}
  try {
    return JSON.parse(jsonString)
  } catch (error) {
    console.warn("JSON.parse failed, attempting to fix string:", jsonString)
    try {
      const fixedString = jsonString
        .replace(/(?<!\\)'/g, '"') // تبدیل single-quote به double-quote
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":') // اضافه کردن کوتیشن به کلیدها
        .replace(/,\s*([}\]])/g, "$1") // حذف ویرگول‌های اضافی در انتها
      return JSON.parse(fixedString)
    } catch (finalError) {
      console.error("Critical JSON parse error after fix:", finalError)
      return {} // اگر باز هم شکست خورد، یک آبجکت خالی برگردان
    }
  }
}
// ... (بقیه توابع کمکی شما) ...
type ExtendedChatSettings = ChatSettings & {
  maxTokens?: number
  max_tokens?: number
}
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
  "gpt-5-nano",
  "gpt-5-mini"
])
const MODELS_THAT_SHOULD_NOT_STREAM = new Set(["gpt-5", "gpt-5-mini"])
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
    const { chatSettings, messages } = await request.json()

    // توصیه می‌شود این آدرس را در فایل .env.local قرار دهید
    // مثال: FILE_SERVER_URL=http://your-ip-or-domain:3000
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
          "شما یک دستیار هوش مصنوعی هستید که فقط به زبان فارسی پاسخ می‌دهید. وظیفه شما اجرای دقیق ابزارهاست. وقتی ابزاری را اجرا می‌کنی، نتیجه را به صورت یک پاسخ روان و کوتاه به کاربر اعلام کن. هرگز داده‌های خام JSON را نمایش نده. **قانون بسیار مهم: وقتی خودت محتوای یک فایل (مانند نامه یا گزارش) را می‌نویسی، باید دقیقاً همان متن را در پارامتر `content` ابزار مربوطه قرار دهی. پارامتر `title` را هم از موضوع اصلی درخواست استخراج کن.**"
      },
      ...(Array.isArray(messages) ? messages : [])
    ]

    const cs = chatSettings as ExtendedChatSettings
    const maxTokens = pickMaxTokens(cs, selectedModel)
    const temp = typeof cs.temperature === "number" ? cs.temperature : 1
    const useStream = !MODELS_THAT_SHOULD_NOT_STREAM.has(selectedModel)

    if (useStream) {
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

              if (delta?.tool_calls) {
                hasToolCall = true
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index
                  // ✅✅✅ اصلاحیه اصلی برای خطای تایپ‌اسکریپت اینجاست ✅✅✅
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

            if (hasToolCall) {
              const newMessages: ChatCompletionMessageParam[] = [
                ...finalMessages,
                { role: "assistant", tool_calls: toolCalls }
              ]

              for (const toolCall of toolCalls) {
                if (toolCall.type === "function") {
                  const functionName = toolCall.function.name
                  const functionArgs = safeJSONParse(
                    toolCall.function.arguments
                  )

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
    } else {
      // --- حالت غیر استریم ---
      const payload: ChatCompletionCreateParams = {
        model: selectedModel,
        messages: finalMessages,
        stream: false,
        temperature: temp,
        tools: tools,
        tool_choice: "auto",
        ...(MODELS_NEED_MAX_COMPLETION.has(selectedModel)
          ? { max_completion_tokens: maxTokens }
          : { max_tokens: maxTokens })
      }

      const response = await openai.chat.completions.create(payload)
      const responseMessage = response.choices[0].message

      if (responseMessage.tool_calls) {
        const newMessages: ChatCompletionMessageParam[] = [
          ...finalMessages,
          responseMessage
        ]

        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type === "function") {
            const functionName = toolCall.function.name
            const functionArgs = safeJSONParse(toolCall.function.arguments)

            console.log("📌 Function Name:", functionName)
            console.log("📦 Function Args:", functionArgs)
            console.log("📦 RAW Function Args:", toolCall.function?.arguments)

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

        const finalResponse = await openai.chat.completions.create({
          model: selectedModel,
          messages: newMessages
        })
        const finalContent =
          finalResponse.choices[0].message.content ?? "ابزار با موفقیت اجرا شد."
        const finalUsage = finalResponse.usage

        if (finalUsage) {
          const userCostUSD = calculateUserCostUSD(selectedModel, finalUsage)
          if (userCostUSD > 0 && wallet && wallet.balance >= userCostUSD) {
            await supabase.rpc("deduct_credits_and_log_usage", {
              p_user_id: user.id,
              p_model_name: selectedModel,
              p_prompt_tokens: finalUsage.prompt_tokens,
              p_completion_tokens: finalUsage.completion_tokens,
              p_cost: userCostUSD
            })
          }
        }
        return new Response(finalContent, {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        })
      } else {
        const content = response.choices[0].message.content ?? ""
        const usage = response.usage
        if (usage) {
          const userCostUSD = calculateUserCostUSD(selectedModel, usage)
          if (userCostUSD > 0 && wallet && wallet.balance >= userCostUSD) {
            await supabase.rpc("deduct_credits_and_log_usage", {
              p_user_id: user.id,
              p_model_name: selectedModel,
              p_prompt_tokens: usage.prompt_tokens,
              p_completion_tokens: usage.completion_tokens,
              p_cost: userCostUSD
            })
          }
        }
        return new Response(content, {
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        })
      }
    }
  } catch (error: any) {
    console.error("!!! MCP ROUTE ERROR CATCH !!!:", error)
    const errorMessage = error.message || "یک خطای غیرمنتظره در مسیر MCP رخ داد"
    const status = error.status || 500
    return NextResponse.json({ message: errorMessage }, { status })
  }
}
