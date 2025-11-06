// 📍 app/api/chat/livekit-token/route.ts (اصلاح کامل معماری)

import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { AccessToken } from "livekit-server-sdk"

// !!! این مقادیر را از داشبورد LiveKit Cloud خود دریافت کنید !!!
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY!
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET!
const LIVEKIT_URL = process.env.LIVEKIT_URL! // e.g., "wss://your-project.livekit.cloud"

export async function POST(request: Request) {
  console.log("🚀 [LiveKit Token Gen] دریافت درخواست از موبایل...")

  try {
    // ✅ مرحله ۱: بررسی توکن کاربر (Supabase JWT)
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const userToken = authHeader.split(" ")[1]
    const decoded = jwt.verify(userToken, process.env.SUPABASE_JWT_SECRET!)
    const userId = (decoded as any).sub
    if (!userId) throw new Error("Invalid Supabase JWT")

    // ✅ مرحله ۲: ایجاد یک اتاق تصادفی یا ثابت
    // شما می‌توانید نام اتاق را بر اساس چت کاربر یا userId تعیین کنید
    const roomName = `user-ai-session-${userId}`
    const participantName = `user-${userId}` // نام کاربری که در اتاق نمایش داده می‌شود

    // ✅ مرحله ۳: ایجاد توکن دسترسی LiveKit
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName
      // name: participantName // (اختیاری) نام نمایشی
    })

    // اجازه‌های لازم برای کلاینت
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true // (اختیاری)
    })

    // توکن JWT نهایی برای LiveKit
    const token = await at.toJwt()

    // ✅ مرحله ۴: بازگرداندن URL سرور LiveKit + توکن
    return NextResponse.json({
      url: LIVEKIT_URL, // آدرس سرور LiveKit شما
      token: token // توکنی که هم‌اکنون ساختید
    })
  } catch (err: any) {
    console.error("❌ [LiveKit Token Gen Error]", err)
    return NextResponse.json({ message: err.message }, { status: 500 })
  }
}
