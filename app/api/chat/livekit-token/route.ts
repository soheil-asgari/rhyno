// 📍 app/api/chat/livekit-token/route.ts

import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export async function POST(request: Request) {
  console.log("🚀 [LiveKit Relay] دریافت درخواست از موبایل...")

  try {
    // ✅ مرحله ۱: بررسی توکن کاربر
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const userToken = authHeader.split(" ")[1]
    const decoded = jwt.verify(userToken, process.env.SUPABASE_JWT_SECRET!)
    const userId = (decoded as any).sub
    if (!userId) throw new Error("Invalid Supabase JWT")

    // ✅ مرحله ۲: ایجاد سشن Realtime از OpenAI
    const openaiRes = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview",
          voice: "alloy" // اختیاری
        })
      }
    )

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      throw new Error(`OpenAI Realtime error: ${err}`)
    }

    const session = await openaiRes.json()

    // ✅ مرحله ۳: بازگرداندن LiveKit URL ثابت + توکن Realtime از OpenAI
    // توجه: URL ثابت است و از session.livekit.url حذف شده
    return NextResponse.json({
      url: "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
      token: session.client_secret.value
    })
  } catch (err: any) {
    console.error("❌ [LiveKit Relay Error]", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
