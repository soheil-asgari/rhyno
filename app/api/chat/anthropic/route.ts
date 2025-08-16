import { ChatSettings } from "@/types"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { StreamingTextResponse } from "ai" // درست کردن ایمپورت برای StreamingTextResponse
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

// تابع تبدیل AsyncIterable به ReadableStream
const asyncIterableToStream = <T>(
  asyncIterable: AsyncIterable<T>
): ReadableStream<T> => {
  return new ReadableStream<T>({
    async pull(controller) {
      for await (const chunk of asyncIterable) {
        controller.enqueue(chunk) // ارسال داده به stream
      }
      controller.close() // بسته شدن stream
    }
  })
}

export const runtime = "edge"

export async function POST(request: NextRequest) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.anthropic_api_key, "Anthropic")

    // فرمت کردن پیام‌ها برای Anthropic
    const ANTHROPIC_FORMATTED_MESSAGES: any = messages
      .slice(1)
      .map((message: any) => {
        const messageContent =
          typeof message?.content === "string"
            ? [message.content]
            : message?.content

        return {
          ...message,
          content: messageContent.map((content: any) => {
            if (typeof content === "string") {
              return { type: "text", text: content }
            } else if (
              content?.type === "image_url" &&
              content?.image_url?.url?.length
            ) {
              return {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png", // Media type باید درست تنظیم شود
                  data: "image-data" // به طور فرضی
                }
              }
            } else {
              return content
            }
          })
        }
      })

    const anthropic = new Anthropic({
      apiKey: profile.anthropic_api_key || ""
    })

    const response = await anthropic.messages.create({
      model: chatSettings.model,
      messages: ANTHROPIC_FORMATTED_MESSAGES,
      temperature: chatSettings.temperature,
      system: messages[0].content,
      max_tokens:
        CHAT_SETTING_LIMITS[chatSettings.model].MAX_TOKEN_OUTPUT_LENGTH,
      stream: true
    })

    // فرض می‌کنیم که `response` به نوع `AsyncIterable<MessageStreamEvent>` تبدیل می‌شود
    const stream = response as AsyncIterable<MessageEvent>

    // تبدیل AsyncIterable به ReadableStream
    const readableStream = asyncIterableToStream(stream)

    // استفاده از StreamingTextResponse
    return new StreamingTextResponse(readableStream)
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "Anthropic API Key not found. Please set it in your profile settings."
    } else if (errorCode === 401) {
      errorMessage =
        "Anthropic API Key is incorrect. Please fix it in your profile settings."
    }

    return new NextResponse(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
