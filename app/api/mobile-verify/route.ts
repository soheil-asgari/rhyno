// In Next.js Project: app/api/mobile-verify/route.ts
// ⚠️ این فایل را در پروژه بک‌اند Next.js خود جایگزین کنید

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createClient } from "@/lib/supabase/server"

// ... (توابع کمکی toE164, generateStrongPassword, normalizePhone را از actions.ts خود اینجا کپی کنید) ...

const toE164 = (phone: string) => {
  if (phone.startsWith("0")) {
    return `+98${phone.slice(1)}`
  }
  if (!phone.startsWith("+")) {
    return `+98${phone}`
  }
  return phone
}

const normalizePhone = (phone: string) => {
  return phone.startsWith("+") ? phone.slice(1) : phone
}

function generateStrongPassword(length = 16): string {
  const lower = "abcdefghijklmnopqrstuvwxyz"
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const numbers = "0123456789"
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?"
  let password = ""
  password += lower[Math.floor(Math.random() * lower.length)]
  password += upper[Math.floor(Math.random() * upper.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  const allChars = lower + upper + numbers + symbols
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  return password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("")
}

export async function POST(request: Request) {
  const { phone, otp } = await request.json() // 👈 ورودی: JSON
  const phoneE164 = toE164(phone)

  const supabase = createClient(cookies())
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // مراحل ۱ تا ۳: اعتبارسنجی OTP (کپی شده از verifyCustomOtpAction)
    const { data: latestOtp, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phoneE164)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError || !latestOtp) {
      return NextResponse.json({ message: "کد نامعتبر" }, { status: 400 })
    }
    if (new Date(latestOtp.expires_at) < new Date()) {
      return NextResponse.json({ message: "کد منقضی شده" }, { status: 400 })
    }
    const isValid = await bcrypt.compare(otp, latestOtp.hashed_otp)
    if (!isValid) {
      return NextResponse.json({ message: "کد نامعتبر" }, { status: 400 })
    }
    await supabase.from("otp_codes").delete().eq("id", latestOtp.id)

    // مرحله ۴: پیدا کردن کاربر
    const { data: users, error: listError } =
      await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw new Error(`Failed to list users: ${listError.message}`)

    const normalizedPhoneE164 = normalizePhone(phoneE164)
    const user = users.users.find(
      u => u.phone === phoneE164 || u.phone === normalizedPhoneE164
    )

    if (!user) {
      // ⚠️ اگر کاربر پیدا نشد، باید او را ثبت‌نام کنیم
      // این بخش در verifyCustomOtpAction شما وجود نداشت و به صفحه ثبت‌نام ریدایرکت می‌شد
      // در موبایل، ما مستقیماً او را ثبت‌نام می‌کنیم
      // (اگر نمی‌خواهید ثبت‌نام خودکار انجام شود، این بخش را حذف کنید و خطای زیر را برگردانید)
      // return NextResponse.json({ message: "اکانت پیدا نشد. ثبت‌نام کنید." }, { status: 404 });

      console.log(`[AUTH] User not found, creating new user for ${phoneE164}`)
      const newPassword = generateStrongPassword()
      const { data: newUserData, error: signUpError } =
        await supabaseAdmin.auth.admin.createUser({
          phone: phoneE164,
          password: newPassword,
          phone_confirm: true
        })

      if (signUpError)
        throw new Error(`Failed to create user: ${signUpError.message}`)

      // حالا با کاربر جدید لاگین می‌کنیم
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          phone: phoneE164,
          password: newPassword
        })

      if (signInError) throw signInError
      if (!signInData.session)
        throw new Error("Session not created after sign up")

      return NextResponse.json({
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token
      })
    }

    // اگر کاربر وجود داشت:
    if (!user.email) throw new Error("User has no email address")

    // مرحله ۵: ایجاد نشست با رمز عبور موقت (کپی شده از verifyCustomOtpAction)
    const temporaryPassword = generateStrongPassword()

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: temporaryPassword
    })

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: user.email, // لاگین با ایمیل انجام می‌شود طبق کد شما
        password: temporaryPassword
      })

    if (signInError) throw signInError
    if (!signInData.session) throw new Error("Session not created")

    // 👈 خروجی: JSON (توکن‌ها)
    return NextResponse.json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token
    })
  } catch (error: any) {
    console.error("[ERROR] Verify OTP Error:", error)
    return NextResponse.json(
      { message: "خطای داخلی سرور", error: error.message },
      { status: 500 }
    )
  }
}
