"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createClient } from "@/lib/supabase/server"

// 👇✅ یک تابع کمکی برای تبدیل تمام شماره‌ها به فرمت استاندارد E.164
const toE164 = (phone: string) => {
  if (phone.startsWith("0")) {
    return `+98${phone.slice(1)}`
  }
  if (!phone.startsWith("+")) {
    return `+98${phone}`
  }
  return phone
}

// 📌 ارسال OTP
export async function sendCustomOtpAction(formData: FormData) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const phone = formData.get("phone") as string
  const refererPath = formData.get("referer") as string

  const phoneE164 = toE164(phone) // تبدیل به فرمت استاندارد

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const message = `کد تایید شما در Rhyno Chat: ${otp}`

    const response = await fetch(`${process.env.IPPANEL_BASE_URL}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.IPPANEL_API_KEY!
      },
      body: JSON.stringify({
        sending_type: "webservice",
        from_number: process.env.IPPANEL_SENDER_LINE,
        message,
        params: { recipients: [phoneE164] } // ارسال SMS با فرمت استاندارد
      })
    })

    const result = await response.json()
    if (!result?.meta?.status) {
      return redirect(
        `${refererPath || "/login"}?message=${encodeURIComponent("ارسال پیامک ناموفق بود")}`
      )
    }

    const hashedOtp = await bcrypt.hash(otp, 10)

    // ذخیره و حذف OTP با فرمت استاندارد
    await supabase.from("otp_codes").delete().eq("phone", phoneE164)
    await supabase.from("otp_codes").insert({
      phone: phoneE164,
      hashed_otp: hashedOtp,
      expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString()
    })

    if (refererPath === "/verify-phone") {
      return redirect(
        `/verify-phone?step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent("کد تایید ارسال شد ✅")}`
      )
    }
    return redirect(
      `/login?method=phone&step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent("کد تایید ارسال شد ✅")}`
    )
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      if ((error as { digest: string }).digest?.startsWith("NEXT_REDIRECT"))
        throw error
    }
    console.error("Send OTP Error:", error)
    return redirect(
      `/login?method=phone&message=${encodeURIComponent("خطا در ارسال پیامک")}`
    )
  }
}

// 📌 تایید OTP برای لاگین/ثبت‌نام
export async function verifyCustomOtpAction(formData: FormData) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const phone = formData.get("phone") as string
  const otp = formData.get("otp") as string

  const phoneE164 = toE164(phone) // تبدیل به فرمت استاندارد

  try {
    // جستجو با فرمت استاندارد
    const { data: latestOtp } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phoneE164)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    if (!latestOtp)
      return redirect(
        `/login?method=phone&step=otp&phone=${phone}&message=${encodeURIComponent("کد نامعتبر است.")}`
      )
    if (new Date(latestOtp.expires_at) < new Date())
      return redirect(
        `/login?method=phone&step=otp&phone=${phone}&message=${encodeURIComponent("کد منقضی شده است.")}`
      )

    const isValid = await bcrypt.compare(otp, latestOtp.hashed_otp)
    if (!isValid)
      return redirect(
        `/login?method=phone&step=otp&phone=${phone}&message=${encodeURIComponent("کد وارد شده اشتباه است.")}`
      )

    await supabase.from("otp_codes").delete().eq("id", latestOtp.id)

    const dummyEmail = `${phoneE164}@example.com` // استفاده از شماره استاندارد
    const secretPassword = `a_very_secret_key_for_${phoneE164}`
    let authResponse = await supabase.auth.signInWithPassword({
      email: dummyEmail,
      password: secretPassword
    })

    if (authResponse.error) {
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabaseAdmin.auth.admin.createUser({
        email: dummyEmail,
        password: secretPassword,
        phone: phoneE164,
        email_confirm: true
      })
      authResponse = await supabase.auth.signInWithPassword({
        email: dummyEmail,
        password: secretPassword
      })
    }

    if (authResponse.error) throw authResponse.error
    if (!authResponse.data.user)
      throw new Error("User not found after sign in.")

    const { data: homeWorkspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", authResponse.data.user.id)
      .eq("is_home", true)
      .single()
    if (!homeWorkspace) return redirect("/setup")
    return redirect(`/${homeWorkspace.id}/chat`)
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      if ((error as { digest: string }).digest?.startsWith("NEXT_REDIRECT"))
        throw error
    }
    console.error("Verify OTP Error:", error)
    return redirect(
      `/login?method=phone&message=${encodeURIComponent("خطا در تایید کد")}`
    )
  }
}

// 📌 تایید OTP و به‌روزرسانی شماره تلفن
export async function verifyAndUpdatePhoneAction(formData: FormData) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const phone = formData.get("phone") as string
  const otp = formData.get("otp") as string

  const phoneE164 = toE164(phone) // تبدیل به فرمت استاندارد

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user)
      return redirect(
        `/login?message=${encodeURIComponent("برای این عملیات باید ابتدا وارد شوید.")}`
      )

    // جستجو با فرمت استاندارد
    const { data: latestOtp } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phoneE164)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    if (!latestOtp)
      return redirect(
        `/verify-phone?step=otp&phone=${phone}&message=${encodeURIComponent("کد نامعتبر است.")}`
      )
    if (new Date(latestOtp.expires_at) < new Date())
      return redirect(
        `/verify-phone?message=${encodeURIComponent("کد منقضی شده است.")}`
      )

    const isValid = await bcrypt.compare(otp, latestOtp.hashed_otp)
    if (!isValid)
      return redirect(
        `/verify-phone?step=otp&phone=${phone}&message=${encodeURIComponent("کد وارد شده اشتباه است.")}`
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
      if (
        updateError.message.includes(
          'duplicate key value violates unique constraint "users_phone_key"'
        )
      ) {
        return redirect(
          `/verify-phone?message=${encodeURIComponent("این شماره تلفن قبلا توسط کاربر دیگری ثبت شده است.")}`
        )
      }
      throw updateError
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "digest" in error) {
      if ((error as { digest: string }).digest?.startsWith("NEXT_REDIRECT"))
        throw error
    }
    console.error("Update Phone Error:", error)
    return redirect(
      `/verify-phone?message=${encodeURIComponent("خطا در به‌روزرسانی شماره تلفن.")}`
    )
  }

  return redirect("/")
}
