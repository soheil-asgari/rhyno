import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { ServerRuntime } from "next"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  try {
    // ۱. احراز هویت
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ message: "Unauthorized: Missing Bearer token" }),
        { status: 401 }
      )
    }
    const token = authHeader.split(" ")[1]

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

    // ۲. گرفتن پروفایل
    const profile = await getServerProfile(userId)
    checkApiKey(profile.google_gemini_api_key, "Google")

    // ۳. داده‌ها از body
    const json = await request.json()
    const { chatSettings, messages } = json as {
      chatSettings: ChatSettings
      messages: any[]
    }

    const genAI = new GoogleGenerativeAI(profile.google_gemini_api_key || "")
    const googleModel = genAI.getGenerativeModel({ model: chatSettings.model })

    // ۴. آماده‌سازی پیام‌ها
    const lastMessage = messages.pop()
    const chat = googleModel.startChat({
      history: messages,
      generationConfig: { temperature: chatSettings.temperature }
    })

    const response = await chat.sendMessageStream(lastMessage.parts)

    // ۵. تبدیل استریم Google به ReadableStream استاندارد
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response.stream) {
            controller.enqueue(encoder.encode(chunk.text()))
          }

          controller.close()
        } catch (err) {
          controller.error(err)
        }
      }
    })

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain" }
    })
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "Google Gemini API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("api key not valid")) {
      errorMessage =
        "Google Gemini API Key is incorrect. Please fix it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
