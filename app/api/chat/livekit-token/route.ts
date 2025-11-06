// 📍 app/api/chat/livekit-token/route.ts (اصلاح‌شده)

import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export async function POST(request: Request) {
  console.log("🚀 [LiveKit Relay] دریافت درخواست از موبایل...")

  try {
    // ✅ مرحله ۱: بررسی توکن کاربر (بدون تغییر)
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const userToken = authHeader.split(" ")[1]
    const decoded = jwt.verify(userToken, process.env.SUPABASE_JWT_SECRET!)
    const userId = (decoded as any).sub
    if (!userId) throw new Error("Invalid Supabase JWT")

    // ✅ مرحله ۲: ایجاد سشن Realtime از OpenAI (بدون تغییر)
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
          voice: "alloy"
        })
      }
    )

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      throw new Error(`OpenAI Realtime error: ${err}`)
    }

    const session = await openaiRes.json()

    // 💡 [اصلاح] بررسی صحت پاسخ OpenAI
    if (
      !session.livekit ||
      !session.livekit.url ||
      !session.client_secret ||
      !session.client_secret.value
    ) {
      console.error("❌ ساختار پاسخ OpenAI نامعتبر است:", session)
      throw new Error("Invalid response structure from OpenAI Realtime API")
    }

    // ✅ مرحله ۳: [اصلاح اصلی] بازگرداندن LiveKit URL *پویا* + توکن Realtime
    return NextResponse.json({
      url: session.livekit.url, // <-- از اینجا بخوانید
      token: session.client_secret.value
    })
  } catch (err: any) {
    console.error("❌ [LiveKit Relay Error]", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
