// مسیر فایل: app/actions.ts

"use server"

import { createClient } from "@/lib/supabase/server" // مطمئن شوید مسیر درست است
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

// تابع برای ثبت‌نام
export async function signUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (password !== confirmPassword) {
    return redirect("/signup?message=Passwords do not match")
  }

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return redirect(`/signup?message=${encodeURIComponent(error.message)}`)
  }

  return redirect("/setup")
}

// تابع برای ورود/ثبت‌نام با گوگل
export async function signInWithGoogle() {
  const origin = headers().get("origin")
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`
    }
  })

  if (error) {
    // در صورت خطا بهتر است به صفحه ثبت‌نام بازگردد
    return redirect(`/signup?message=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    return redirect(data.url)
  }

  return redirect(`/signup?message=Could not get Google auth URL`)
}
export async function sendCustomOtpAction(formData: FormData) {
  const phone = formData.get("phone") as string
  const referer = (formData.get("referer") as string) || "/verify-phone"

  // اعتبارسنجی شماره
  if (!/^09\d{9}$/.test(phone)) {
    return redirect(
      `${referer}?message=${encodeURIComponent("شماره موبایل نامعتبر است")}`
    )
  }

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // ۱. ساخت کد و ذخیره در جدول سفارشی otp_codes
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  await supabase.from("otp_codes").insert({
    phone,
    hashed_otp: otp,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  })

  // ۲. اینجا باید کد ارسال پیامک با پنل خودتان را قرار دهید
  // مثال:
  // await sendSmsWithYourPanel(phone, `کد تایید شما: ${otp}`);
  // console.log(`(شبیه‌سازی ارسال پیامک) کد برای ${phone}: ${otp}`)

  // ۳. هدایت به مرحله وارد کردن کد
  const message = "کد برای شما ارسال شد"
  return redirect(
    `${referer}?step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}`
  )
}
