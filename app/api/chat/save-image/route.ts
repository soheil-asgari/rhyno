// in /api/save-image/route.ts

import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import crypto from "crypto"

// این فایل در محیط استاندارد Node.js اجرا می‌شود

export async function POST(request: Request) {
  const { tempUrl } = await request.json()

  if (!tempUrl) {
    return NextResponse.json(
      { message: "tempUrl is required" },
      { status: 400 }
    )
  }

  try {
    const profile = await getServerProfile()
    const userId = profile.user_id

    // از Service Key برای امنیت در بک‌اند استفاده کنید
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // دانلود داده‌های عکس از URL موقت
    const imageResponse = await fetch(tempUrl)
    const imageBlob = await imageResponse.blob()

    // آپلود عکس در Supabase Storage
    const bucketName = "generated-images" // نام باکتی که در Supabase ساخته‌اید
    const fileName = `${userId}/${crypto.randomUUID()}.png`

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, imageBlob, {
        contentType: "image/png",
        cacheControl: "31536000",
        upsert: false
      })

    if (uploadError) {
      throw uploadError
    }

    // دریافت URL عمومی و دائمی از Supabase
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    const permanentUrl = publicUrlData.publicUrl

    // (اختیاری) می‌توانید این URL دائمی را در دیتابیس خود نیز ذخیره کنید
    // await supabaseAdmin.from('your_table').insert({ user_id: userId, image_url: permanentUrl });

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
