import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { ChatCompletionCreateParamsStreaming, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions.mjs"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const modelsWithFixedTemperature = ["gpt-4-vision-preview", "gpt-4o", "gpt-5"]

    const organizationVerified = false // وقتی سازمان تایید شد این مقدار رو true بکنید

    const enableStream = organizationVerified

    if (enableStream) {
      // حالت استریم واقعی
      const requestPayload: ChatCompletionCreateParamsStreaming = {
        model: chatSettings.model as ChatCompletionCreateParamsStreaming["model"],
        messages: messages as ChatCompletionCreateParamsStreaming["messages"],
        stream: true,
        temperature: modelsWithFixedTemperature.includes(chatSettings.model)
          ? 1
          : chatSettings.temperature
      }

      const response = await openai.chat.completions.create(requestPayload)
      const stream = OpenAIStream(response)
      return new StreamingTextResponse(stream)
    } else {
      // حالت غیر استریم با استریم اولیه (fake stream) برای جلوگیری از تایم‌اوت

      const encoder = new TextEncoder()

      // شروع استریم: ابتدا پیام کوتاه "در حال پردازش..." ارسال می‌شود
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode("در حال پردازش... \n"))

          try {
            const requestPayload: ChatCompletionCreateParamsNonStreaming = {
              model: chatSettings.model as ChatCompletionCreateParamsNonStreaming["model"],
              messages: messages as ChatCompletionCreateParamsNonStreaming["messages"],
              stream: false,
              temperature: modelsWithFixedTemperature.includes(chatSettings.model)
                ? 1
                : chatSettings.temperature
            }

            const response = await openai.chat.completions.create(requestPayload)
            const content = response.choices[0].message?.content || ""

            controller.enqueue(encoder.encode(content))
            controller.close()
          } catch (error: any) {
            const errorMessage = error.message || "خطای غیرمنتظره"
            controller.enqueue(encoder.encode(`Error: ${errorMessage}`))
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      })
    }
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "OpenAI API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("incorrect api key")) {
      errorMessage =
        "OpenAI API Key is incorrect. Please fix it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode,
      headers: {
        "Content-Type": "application/json"
      }
    })
  }
}
