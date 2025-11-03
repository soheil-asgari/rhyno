import { NextResponse } from "next/server"
import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const { phone, otp } = await req.json()
  const cookieStore = cookies()

  // ۱. OTP رو از Supabase چک کن
  // (باید قبلاً تو جدول otp_codes ذخیره کرده باشی)
  const supabase = createSSRClient(cookieStore)

  const { data: record } = await supabase
    .from("otp_codes")
    .select("*")
    .eq("phone", phone)
    .eq("otp", otp)
    .single()

  if (!record) {
    return NextResponse.json({ success: false, message: "کد نامعتبر" })
  }

  // ۲. اگر کاربر وجود نداره، بساز
  const { data: user, error } = await supabase.auth.signUp({
    phone,
    password: process.env.DEFAULT_USER_PASS! // یه پسورد پیش‌فرض امن بذار
  })

  if (error) {
    return NextResponse.json({ success: false, error: error.message })
  }

  // ۳. برگردوندن workspace برای redirect
  return NextResponse.json({
    success: true,
    workspaceId: "homeWorkspaceId"
  })
}
