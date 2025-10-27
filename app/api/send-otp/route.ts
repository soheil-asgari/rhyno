// In Next.js Project: app/api/send-otp/route.ts
// ⚠️ این فایل جدید را در پروژه بک‌اند Next.js خود بسازید

import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

// تابع کمکی (کپی شده از actions.ts)
const toE164 = (phone: string) => {
  if (phone.startsWith("0")) {
    return `+98${phone.slice(1)}`
  }
  if (!phone.startsWith("+")) {
    return `+98${phone}`
  }
  return phone
}

export async function POST(request: Request) {
  const { phone } = await request.json() // 👈 ورودی: JSON
  const phoneE164 = toE164(phone)

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // ۱. تولید کد OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // ۲. ارسال OTP به سرویس sms.ir (کپی شده از actions.ts)
    const response = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SMSIR_API_KEY!
      },
      body: JSON.stringify({
        mobile: phoneE164,
        templateId: Number(process.env.SMSIR_TEMPLATE_ID),
        parameters: [{ name: "RHYONCHAT", value: otp }] // ⚠️ نام پترن را چک کنید
      })
    })
    const result = await response.json()
    if (!result || result.status !== 1) {
      console.error("[SMS] sms.ir send error:", result)
      return NextResponse.json(
        { success: false, message: "خطا در ارسال SMS" },
        { status: 500 }
      )
    }

    // ۳. هش کردن OTP
    const hashedOtp = await bcrypt.hash(otp, 10)

    // ۴. حذف OTPهای قبلی
    await supabaseAdmin.from("otp_codes").delete().eq("phone", phoneE164)

    // ۵. درج OTP جدید
    const { error: insertError } = await supabaseAdmin
      .from("otp_codes")
      .insert({
        phone: phoneE164,
        hashed_otp: hashedOtp,
        expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString() // ۲ دقیقه انقضا
      })

    if (insertError) throw insertError

    // ۶. 👈 خروجی: JSON
    return NextResponse.json({ success: true, message: "کد ارسال شد" })
  } catch (error: any) {
    console.error("[ERROR] Send OTP Error:", error)
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }
}
