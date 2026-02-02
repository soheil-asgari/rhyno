import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { ServerRuntime } from "next"
import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@supabase/supabase-js"

import jwt from "jsonwebtoken"

export const runtime: ServerRuntime = "nodejs"

// این فایل در محیط Node.js اجرا می‌شود

export async function POST(request: Request) {
  const { tempUrl, userId } = await request.json() // userId را از کلاینت بفرستید یا Authorization استخراج کنید

  if (!tempUrl || !userId) {
    return NextResponse.json(
      { message: "tempUrl and userId are required" },
      { status: 400 }
    )
  }

  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized: Missing Bearer token", {
        status: 401
      })
    }
    const token = authHeader.split(" ")[1]

    let userId: string

    // ۱. اعتبارسنجی دستی توکن با JWT_SECRET
    try {
      if (!process.env.SUPABASE_JWT_SECRET) {
        throw new Error("SUPABASE_JWT_SECRET is not set on server!")
      }
      const decodedToken = jwt.verify(
        token,
        process.env.SUPABASE_JWT_SECRET
      ) as jwt.JwtPayload

      if (!decodedToken.sub) {
        throw new Error("Invalid token: No 'sub' (user ID) found.")
      }
      userId = decodedToken.sub // 'sub' همان User ID است
      console.log(`[Agent] ✅ Token MANUALLY verified! User ID: ${userId}`)
    } catch (err: any) {
      console.error("[Agent] ❌ Manual JWT Verification Failed:", err.message)
      return new NextResponse(
        `Unauthorized: Manual verification failed: ${err.message}`,
        { status: 401 }
      )
    }

    // ۲. ساخت کلاینت ادمین (Admin) برای گرفتن آبجکت کامل User
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on server!")
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const {
      data: { user },
      error: adminError
    } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (adminError || !user) {
      console.error(
        "[Agent] ❌ Admin client failed to get user:",
        adminError?.message
      )
      return new NextResponse(
        `Unauthorized: User not found with admin client: ${adminError?.message}`,
        { status: 401 }
      )
    }
    console.log(`[Agent] ✅ Full user object retrieved for: ${user.email}`)
    // ============================
    // ۱. گرفتن پروفایل کاربر
    // ============================
    const profile = await getServerProfile(userId, supabaseAdmin)
    if (!profile) throw new Error("User profile not found")

    // ============================
    // ۲. ساخت کلاینت Supabase با Service Role
    // ============================

    // ============================
    // ۳. دانلود تصویر
    // ============================
    const imageResponse = await fetch(tempUrl)
    if (!imageResponse.ok) throw new Error("Failed to download image")
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // ============================
    // ۴. آپلود به Supabase Storage
    // ============================
    const bucketName = "generated-images"
    const fileName = `${userId}/${crypto.randomUUID()}.png`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, imageBuffer, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false
      })

    if (uploadError) throw uploadError

    // ============================
    // ۵. دریافت URL عمومی
    // ============================
    const publicData = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    const permanentUrl = publicData.data.publicUrl
    if (!permanentUrl) throw new Error("Failed to get public URL")

    return NextResponse.json({ permanentUrl })
  } catch (error: any) {
    console.error("Error in /api/save-image:", error)
    const errorMessage = error.message || "An unknown error occurred"
    return NextResponse.json(
      { message: `Failed to save image: ${errorMessage}` },
      { status: 500 }
    )
  }
}
