// 📍 app/api/chat/livekit-token/route.ts (نسخه نهایی برای WebView)

import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export async function POST(request: Request) {
  console.log("🚀 [OpenAI Token] دریافت درخواست از وب...")

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
          voice: "alloy"
        })
      }
    )

    if (!openaiRes.ok) {
      const err = await openaiRes.text()
      throw new Error(`OpenAI Realtime error: ${err}`)
    }

    const session = await openaiRes.json()

    // 💡 بررسی صحت پاسخ OpenAI
    if (!session.client_secret || !session.client_secret.value) {
      console.error("❌ ساختار پاسخ OpenAI نامعتبر است:", session)
      throw new Error("Invalid response structure from OpenAI Realtime API")
    }

    // ✅ مرحله ۳: بازگرداندن توکن OpenAI (کلاینت سکرت)
    return NextResponse.json({
      token: session.client_secret.value
    })
  } catch (err: any) {
    console.error("❌ [OpenAI Token Error]", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
