// 📍 فایل جدید: app/api/chat/livekit-token/route.ts

import { NextResponse } from "next/server"
import { AccessToken } from "livekit-server-sdk"
import jwt from "jsonwebtoken" // برای خواندن توکن کاربر

// (اگر از createAdminClient استفاده می‌کنید، آن را هم ایمپورت کنید)
// import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  console.log("🚀 [LiveKit Token] درخواست توکن از موبایل دریافت شد...")

  try {
    // ۱. احراز هویت کاربر (دقیقاً همان کدی که در route.ts دیگرتان دارید)
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized: Missing Bearer token", {
        status: 401
      })
    }

    const userToken = authHeader.split(" ")[1]
    const decodedToken = jwt.verify(
      userToken,
      process.env.SUPABASE_JWT_SECRET!
    ) as jwt.JwtPayload

    const userId = decodedToken.sub
    if (!userId) {
      throw new Error("Invalid token: No 'sub' (user ID) found.")
    }
    console.log(`✅ [LiveKit Token] کاربر ${userId} احراز هویت شد.`)

    // ۲. خواندن کلیدهای LiveKit از .env
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    const host = process.env.LIVEKIT_HOST_URL

    if (!apiKey || !apiSecret || !host) {
      console.error(
        "❌ [LiveKit Token] متغیرهای .env سرور LiveKit تنظیم نشده‌اند."
      )
      throw new Error("LiveKit server configuration is missing.")
    }

    // ۳. ساخت توکن LiveKit
    const roomName = `openai_call_${userId}_${Date.now()}`
    const at = new AccessToken(apiKey, apiSecret, { identity: userId })

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true
    })

    const livekitToken = await at.toJwt()

    // ۴. ارسال توکن به موبایل
    return NextResponse.json({
      token: livekitToken,
      url: host,
      roomName: roomName
    })
  } catch (error: any) {
    console.error("❌ [LiveKit Token] خطا در ساخت توکن:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
