// مسیر فایل جدید: app/api/chat/tts/route.ts

import { handleTTS } from "@/app/api/chat/handlers/tts" // <-- ✨ وارد کردن منطق از فایل هندلر شما
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { chatSettings, messages } = await request.json()
    const lastUserMessageContent = messages[messages.length - 1]?.content || ""

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
      const keywordIndex = textToSpeak.toLowerCase().indexOf(keyword)
      if (keywordIndex !== -1) {
        textToSpeak = textToSpeak
          .substring(keywordIndex + keyword.length)
          .trim()
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

    const ttsBody = {
      input: textToSpeak,
      voice: chatSettings.voice || "coral",
      speed: chatSettings.speed || 1.0,
      model: "gpt-4o-mini-tts"
    }
    console.log(
      "📞 [TTS Handler] Calling handleTTS with body:",
      JSON.stringify(ttsBody, null, 2)
    )
    const response = await handleTTS({ body: ttsBody, user, supabase })
    console.log(
      "✅ [TTS Handler] handleTTS returned successfully. Status:",
      response.status
    )
    return await handleTTS({ body: ttsBody, user, supabase })
  } catch (error: any) {
    console.error("Error in TTS route:", error)
    console.error("❌ [TTS Handler] CRITICAL ERROR caught in TTS route:", error)
    return NextResponse.json(
      { message: error.message || "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
