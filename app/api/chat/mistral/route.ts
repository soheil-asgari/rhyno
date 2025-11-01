import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import OpenAI from "openai"
import { ServerRuntime } from "next"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  try {
    // ۱. احراز هویت با Bearer Token
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

    // ۲. گرفتن پروفایل
    const profile = await getServerProfile(user.id)
    checkApiKey(profile.mistral_api_key, "Mistral")

    // ۳. دریافت داده‌ها از body
    const json = await request.json()
    const { chatSettings, messages } = json as {
      chatSettings: ChatSettings
      messages: any[]
    }

    // ۴. ایجاد کلاینت Mistral (OpenAI compatible)
    const mistral = new OpenAI({
      apiKey: profile.mistral_api_key || "",
      baseURL: "https://api.mistral.ai/v1"
    })

    // ۵. ایجاد Completion با استریم
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${profile.mistral_api_key}`
      },
      body: JSON.stringify({
        model: chatSettings.model,
        messages,
        max_tokens:
          CHAT_SETTING_LIMITS[chatSettings.model].MAX_TOKEN_OUTPUT_LENGTH,
        stream: true
      })
    })

    // ۶. بازگرداندن استریم مستقیم به کلاینت
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    })
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "Mistral API Key not found. Please set it in your profile settings."
    } else if (errorCode === 401) {
      errorMessage =
        "Mistral API Key is incorrect. Please fix it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
