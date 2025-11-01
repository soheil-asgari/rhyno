// مسیر فایل: app/api/chat/tts/route.ts

import { handleTTS } from "@/app/api/chat/handlers/tts"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { chatSettings, messages } = await request.json()
    const lastUserMessageContent = messages[messages.length - 1]?.content || ""

    // پاک کردن کلمات کلیدی TTS از متن
    const ttsKeywords = [
      "به صدا تبدیلش کن",
      "صداش کن",
      "صدا کن",
      "بخون",
      "بگو",
      "تبدیل به صدا"
    ]
    let textToSpeak = lastUserMessageContent
    for (const keyword of ttsKeywords) {
      const idx = textToSpeak.toLowerCase().indexOf(keyword)
      if (idx !== -1) {
        textToSpeak = textToSpeak.substring(idx + keyword.length).trim()
        if (textToSpeak.startsWith(":") || textToSpeak.startsWith("-")) {
          textToSpeak = textToSpeak.substring(1).trim()
        }
        break
      }
    }

    if (!textToSpeak) {
      return NextResponse.json(
        { message: "لطفاً متنی که باید به صدا تبدیل شود را مشخص کنید." },
        { status: 400 }
      )
    }

    // ساخت کلاینت Supabase
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    // گرفتن کاربر
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse("Unauthorized", { status: 401 })

    // گرفتن کلید OpenAI از پروفایل کاربر
    const { data: profile } = await supabase
      .from("profiles")
      .select("openai_api_key")
      .eq("id", user.id)
      .single()

    if (!profile?.openai_api_key) {
      return NextResponse.json(
        { message: "API key برای OpenAI موجود نیست." },
        { status: 403 }
      )
    }

    // آماده‌سازی body برای TTS
    const ttsBody = {
      input: textToSpeak,
      voice: chatSettings.voice || "coral",
      speed: chatSettings.speed || 1.0,
      model: "gpt-4o-mini-tts"
    }

    // فراخوانی handleTTS با کلید OpenAI
    const response = await handleTTS({
      body: ttsBody,
      request,
      user,
      supabase,
      openaiApiKey: profile.openai_api_key // ⚡ مهم!
    })

    return response
  } catch (error: any) {
    console.error("❌ Error in TTS route:", error)
    return NextResponse.json(
      { message: error.message || "خطای سرور" },
      { status: 500 }
    )
  }
}
