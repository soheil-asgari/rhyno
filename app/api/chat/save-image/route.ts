import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import crypto from "crypto"

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
    // ============================
    // ۱. گرفتن پروفایل کاربر
    // ============================
    const profile = await getServerProfile(userId)
    if (!profile) throw new Error("User profile not found")

    // ============================
    // ۲. ساخت کلاینت Supabase با Service Role
    // ============================
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
