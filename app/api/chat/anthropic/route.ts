import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { getBase64FromDataURL, getMediaTypeFromDataURL } from "@/lib/utils"
import { ChatSettings } from "@/types"
import Anthropic from "@anthropic-ai/sdk"
import { AnthropicStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  try {
    // ✨ ۱. احراز هویت
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ message: "Unauthorized: Missing Bearer token" }),
        { status: 401 }
      )
    }
    const token = authHeader.split(" ")[1]

    // ✨ ۲. ساخت کلاینت Supabase
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ message: "Unauthorized: Invalid token" }),
        { status: 401 }
      )
    }
    const userId = user.id

    // ✨ ۳. گرفتن پروفایل سرور
    const profile = await getServerProfile(userId)
    checkApiKey(profile.anthropic_api_key, "Anthropic")

    // ✨ ۴. دریافت داده‌ها از body
    const json = await request.json()
    const { chatSettings, messages } = json as {
      chatSettings: ChatSettings
      messages: any[]
    }

    // ✨ ۵. آماده‌سازی پیام‌ها
    let ANTHROPIC_FORMATTED_MESSAGES: any = messages
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
                  media_type: getMediaTypeFromDataURL(content.image_url.url),
                  data: getBase64FromDataURL(content.image_url.url)
                }
              }
            } else {
              return content
            }
          })
        }
      })

    // ✨ ۶. تعامل با Anthropic
    const anthropic = new Anthropic({ apiKey: profile.anthropic_api_key || "" })
    const response = await anthropic.messages.create({
      model: chatSettings.model,
      messages: ANTHROPIC_FORMATTED_MESSAGES,
      temperature: chatSettings.temperature,
      system: messages[0].content,
      max_tokens:
        CHAT_SETTING_LIMITS[chatSettings.model].MAX_TOKEN_OUTPUT_LENGTH,
      stream: true
    })

    const stream = AnthropicStream(response)
    return new StreamingTextResponse(stream)
  } catch (error: any) {
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
