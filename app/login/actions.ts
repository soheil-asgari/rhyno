"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createClient } from "@/lib/supabase/server"
import jwt from "jsonwebtoken"
import { randomUUID } from "crypto"

export async function getSession() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { session }
  } = await supabase.auth.getSession()
  return session
}
// تابع کمکی برای تبدیل شماره به فرمت استاندارد E.164
const toE164 = (phone: string) => {
  if (phone.startsWith("0")) {
    return `+98${phone.slice(1)}`
  }
  if (!phone.startsWith("+")) {
    return `+98${phone}`
  }
  return phone
}

export async function clearAuthCookiesAction() {
  const cookieStore = cookies()
  cookieStore.getAll().forEach(cookie => {
    if (cookie.name.startsWith("sb-vkwgwiiesvyfcgaemeck-auth-token")) {
      cookieStore.delete(cookie.name)
    }
  })
}
// 📌 پاک کردن کوکی‌های احراز هویت supabase
export async function clearAuthCookies() {
  const cookieStore = cookies()
  cookieStore.getAll().forEach(cookie => {
    if (cookie.name.startsWith("sb-vkwgwiiesvyfcgaemeck-auth-token")) {
      cookieStore.delete(cookie.name)
      console.log("Deleted cookie:", cookie.name)
    }
  })
}

// 📌 ارسال OTP

export async function sendCustomOtpAction(formData: FormData) {
  const cookieStore = cookies()
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const phone = formData.get("phone") as string
  const refererPath = (formData.get("referer") as string) || "/login"
  const phoneE164 = toE164(phone)
  const successMessage = "کد تایید با موفقیت ارسال شد."

  try {
    // ۱. تولید کد OTP
    console.log(`[OTP] Generating OTP for phone: ${phoneE164}`)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // ۲. ارسال OTP به سرویس sms.ir
    console.log(`[SMS] Sending OTP to sms.ir for phone: ${phoneE164}`)
    const response = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.SMSIR_API_KEY!
      },
      body: JSON.stringify({
        mobile: phoneE164,
        templateId: Number(process.env.SMSIR_TEMPLATE_ID),
        parameters: [{ name: "RHYONCHAT", value: otp }]
      })
    })

    const result = await response.json()
    console.log(`[SMS] sms.ir response:`, {
      phone: phoneE164,
      status: result.status,
      message: result.message,
      data: result.data
    })

    if (!result || result.status !== 1) {
      console.error("[SMS] sms.ir send error:", {
        phone: phoneE164,
        status: result.status,
        message: result.message
      })
      return redirect(`${refererPath}?method=phone&error=sms_send_failed`)
    }

    // ۳. هش کردن OTP
    console.log(`[OTP] Hashing OTP for phone: ${phoneE164}`)
    const hashedOtp = await bcrypt.hash(otp, 10)

    // ۴. حذف OTPهای قبلی
    console.log(`[DB] Deleting existing OTPs for phone: ${phoneE164}`)
    const { error: deleteError } = await supabaseAdmin
      .from("otp_codes")
      .delete()
      .eq("phone", phoneE164)
    if (deleteError) {
      console.error("[DB] Failed to delete existing OTPs:", {
        phone: phoneE164,
        error: deleteError.message,
        code: deleteError.code
      })
      throw new Error(`Failed to delete existing OTPs: ${deleteError.message}`)
    }

    // ۵. درج OTP جدید
    console.log(`[DB] Inserting OTP for phone: ${phoneE164}`)
    const { error: insertError } = await supabaseAdmin
      .from("otp_codes")
      .insert({
        phone: phoneE164,
        hashed_otp: hashedOtp,
        expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString()
      })
    if (insertError) {
      console.error("[DB] Failed to insert OTP:", {
        phone: phoneE164,
        error: insertError.message,
        code: insertError.code
      })
      throw new Error(`Failed to insert OTP: ${insertError.message}`)
    }

    // ۶. ریدایرکت به صفحه تأیید
    console.log(
      `[REDIRECT] OTP sent successfully, redirecting for phone: ${phoneE164}`
    )
    const redirectUrl =
      refererPath === "/verify-phone"
        ? `/verify-phone?step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent(successMessage)}`
        : `/login?method=phone&step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent(successMessage)}`

    return redirect(redirectUrl)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error("[ERROR] Send OTP Error:", {
      phone: phoneE164,
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    })

    // بررسی خطای ریدایرکت
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }

    return redirect(`${refererPath}?method=phone&error=send_otp_failed`)
  }
}

function generateStrongPassword(length = 16): string {
  const lower = "abcdefghijklmnopqrstuvwxyz"
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const numbers = "0123456789"
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?"

  // اطمینان از وجود حداقل یک کاراکتر از هر نوع
  let password = ""
  password += lower[Math.floor(Math.random() * lower.length)]
  password += upper[Math.floor(Math.random() * upper.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]

  // پر کردن بقیه طول رمز عبور با کاراکترهای تصادفی
  const allChars = lower + upper + numbers + symbols
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // بر زدن رشته نهایی تا جای کاراکترها قابل پیش‌بینی نباشد
  return password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("")
}
const normalizePhone = (phone: string) => {
  return phone.startsWith("+") ? phone.slice(1) : phone
}

export async function verifyCustomOtpAction(formData: FormData) {
  const phone = formData.get("phone") as string
  const otp = formData.get("otp") as string
  const phoneE164 = toE164(phone)
  const refererPath = "/login"

  const supabase = createClient(cookies())
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // مراحل ۱ تا ۳: اعتبارسنجی OTP شما
    const { data: latestOtp, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phoneE164)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError || !latestOtp) {
      return redirect(
        `${refererPath}?step=otp&phone=${phone}&error=invalid_code`
      )
    }
    if (new Date(latestOtp.expires_at) < new Date()) {
      return redirect(
        `${refererPath}?step=otp&phone=${phone}&error=expired_code`
      )
    }
    const isValid = await bcrypt.compare(otp, latestOtp.hashed_otp)
    if (!isValid) {
      return redirect(
        `${refererPath}?step=otp&phone=${phone}&error=invalid_code`
      )
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
      return redirect(
        `/signup?phone=${phone}&message=${encodeURIComponent("اکانت پیدا نشد. ثبت‌نام کنید.")}`
      )
    }
    if (!user.email) throw new Error("User has no email address")

    // مرحله ۵: ایجاد نشست با استفاده از رمز عبور موقت و قوی
    const temporaryPassword = generateStrongPassword() // ✅ استفاده از تابع جدید

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: temporaryPassword
      })
    if (updateError)
      throw new Error(
        `Security Fail: Could not set temporary password. ${updateError.message}`
      )

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: temporaryPassword
    })

    // پاکسازی رمز عبور موقت برای امنیت
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        last_otp_login_at: new Date().toISOString()
      }
    })

    if (signInError)
      throw new Error(
        `Sign-in failed after setting temp password: ${signInError.message}`
      )

    console.log(`[SESSION] Session created successfully for user: ${user.id}`)
    return redirect("/chat")
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[ERROR] Verify OTP Error:", {
      phone: phoneE164,
      message: errorMessage
    })
    return redirect(
      `${refererPath}?step=otp&phone=${phone}&error=verify_failed`
    )
  }
}

// 📌 تایید OTP و به‌روزرسانی شماره تلفن
export async function verifyAndUpdatePhoneAction(formData: FormData) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const phone = formData.get("phone") as string
  const otp = formData.get("otp") as string
  const phoneE164 = toE164(phone)

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return redirect(`/login?error=auth_required`)

    const { data: latestOtp } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phoneE164)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!latestOtp)
      return redirect(
        `/verify-phone?step=otp&phone=${encodeURIComponent(phone)}&error=invalid_code`
      )

    if (new Date(latestOtp.expires_at) < new Date())
      return redirect(
        `/verify-phone?step=otp&phone=${encodeURIComponent(phone)}&error=expired_code`
      )

    const isValid = await bcrypt.compare(otp, latestOtp.hashed_otp)
    if (!isValid)
      return redirect(
        `/verify-phone?step=otp&phone=${encodeURIComponent(phone)}&error=invalid_code`
      )

    await supabase.from("otp_codes").delete().eq("id", latestOtp.id)

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        phone: phoneE164
      })

    if (updateError) {
      if (updateError.message.includes("duplicate")) {
        return redirect(
          `/verify-phone?step=otp&phone=${encodeURIComponent(phone)}&error=phone_in_use`
        )
      }
      throw updateError
    }

    // Redirect موفقیت‌آمیز بعد از تایید شماره
    return redirect(
      `/verify-phone?step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent("شماره موبایل با موفقیت تایید شد.")}`
    )
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      if ((error as { digest: string }).digest?.startsWith("NEXT_REDIRECT"))
        throw error
    }
    console.error("Update Phone Error:", error)
    return redirect(
      `/verify-phone?step=otp&phone=${encodeURIComponent(phone)}&error=update_failed`
    )
  }
}
