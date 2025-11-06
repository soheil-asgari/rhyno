// 📍 app/api/chat/livekit-token/route.ts
import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"

export async function POST(request: Request) {
  console.log("🚀 [LiveKit Relay] دریافت درخواست از موبایل...")

  try {
    // 🧩 ۱. احراز هویت Supabase
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const userToken = authHeader.split(" ")[1]
    const decoded = jwt.verify(
      userToken,
      process.env.SUPABASE_JWT_SECRET!
    ) as jwt.JwtPayload
    const userId = decoded?.sub
    if (!userId) throw new Error("Invalid Supabase JWT")

    // ⚙️ ۲. تنظیم مدل و voice از سمت کلاینت
    const body = await request.json().catch(() => ({}))
    const model = body.model || "gpt-4o-realtime-preview"
    const voice = body.voice || "alloy"

    // 🎧 ۳. ایجاد session جدید از OpenAI Realtime
    const openaiRes = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model, voice })
      }
    )

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      throw new Error(`OpenAI Realtime error: ${errText}`)
    }

    const session = await openaiRes.json()

    // 🚀 ۴. پاسخ نهایی به موبایل
    return NextResponse.json({
      url: session.livekit.url,
      token: session.client_secret.value
    })
  } catch (err: any) {
    console.error("❌ [LiveKit Relay Error]", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
