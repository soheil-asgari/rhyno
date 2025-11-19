import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createClient as createSSRClient } from "@/lib/supabase/server"

// --- تنظیمات ---
const INITIAL_FREE_CREDIT = 50000 // مبلغ شارژ اولیه (۵۰ هزار تومان)

// --- توابع کمکی ---
const toE164 = (phone: string) => {
  if (phone.startsWith("0")) return `+98${phone.slice(1)}`
  if (!phone.startsWith("+")) return `+98${phone}`
  return phone
}

function generateStrongPassword(length = 16): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function POST(request: Request) {
  const { phone, otp } = await request.json()
  const phoneE164 = toE164(phone)
  // ساخت ایمیل فیک برای دور زدن محدودیت لاگین موبایل
  const fakeEmail = `${phoneE164.replace("+", "")}@placeholder.rhyno`

  const cookieStore = cookies()
  const supabase = createSSRClient(cookieStore)
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // ۱. بررسی صحت کد OTP
    const { data: latestOtp, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phoneE164)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError || !latestOtp) {
      return NextResponse.json({ message: "کد نامعتبر است" }, { status: 400 })
    }

    const isValid = await bcrypt.compare(otp, latestOtp.hashed_otp)
    if (!isValid) {
      return NextResponse.json(
        { message: "کد وارد شده صحیح نیست" },
        { status: 400 }
      )
    }
    if (new Date(latestOtp.expires_at) < new Date()) {
      return NextResponse.json({ message: "کد منقضی شده است" }, { status: 400 })
    }

    // حذف کد استفاده شده
    await supabaseAdmin.from("otp_codes").delete().eq("id", latestOtp.id)

    // ۲. جستجوی کاربر در سیستم
    const { data: users, error: listError } =
      await supabaseAdmin.auth.admin.listUsers()
    if (listError)
      throw new Error(`خطا در دریافت لیست کاربران: ${listError.message}`)

    let user = users.users.find(
      u => u.email === fakeEmail || u.user_metadata?.phone === phoneE164
    )

    const passwordToUse = generateStrongPassword()
    let isNewUser = false

    // ۳. اگر کاربر وجود نداشت (ثبت‌نام) یا وجود داشت (ورود)
    if (!user) {
      // --- حالت ثبت‌نام ---
      isNewUser = true
      console.log(`[AUTH] Creating new user: ${fakeEmail}`)

      const { data: newUserData, error: signUpError } =
        await supabaseAdmin.auth.admin.createUser({
          email: fakeEmail,
          password: passwordToUse,
          email_confirm: true,
          user_metadata: { phone: phoneE164 },
          app_metadata: { provider: "phone_custom" }
        })

      if (signUpError)
        throw new Error(`خطا در ساخت کاربر: ${signUpError.message}`)
      user = newUserData.user
    } else {
      // --- حالت ورود ---
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: fakeEmail,
        email_confirm: true,
        password: passwordToUse,
        user_metadata: { ...user.user_metadata, phone: phoneE164 }
      })
    }

    if (!user) throw new Error("خطا: کاربر ساخته نشد.")

    // ۴. تلاش برای ست کردن شماره موبایل در سطح Auth (ممکن است به خاطر تنظیمات غیرفعال باشد ولی تست می‌کنیم)
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        phone: phoneE164,
        phone_confirm: true
      })
    } catch (e) {
      console.log("Phone update skipped (provider likely disabled)", e)
    }

    // ۵. تنظیمات دیتابیس (پروفایل و کیف پول)
    // الف) ساخت یا آپدیت پروفایل (مهم: فیلدهای اجباری مثل username باید باشند)
    const defaultUsername = `user_${phoneE164.slice(-4)}_${Math.floor(Math.random() * 1000)}`

    // اینجا از upsert استفاده می‌کنیم که هم برای کاربر جدید و هم قدیمی کار کند
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: user.id,
        phone: phoneE164, // ذخیره شماره در پروفایل عمومی
        username: defaultUsername, // فیلد اجباری (در صورت وجود نداشتن)
        display_name: phoneE164, // نمایش شماره به عنوان نام پیش‌فرض
        image_path: "",
        image_url: "",
        bio: ""
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: false
      }
    )

    // اگر پروفایل از قبل باشد، فقط شماره را آپدیت می‌کنیم تا نام کاربری تغییر نکند
    if (profileError) {
      // اگر ارور داد (مثلا تکراری بودن username)، فقط شماره را آپدیت کن
      await supabaseAdmin
        .from("profiles")
        .update({
          phone: phoneE164
        })
        .eq("user_id", user.id)
    }

    // ب) اعمال شارژ اولیه (فقط برای کاربر جدید)
    if (isNewUser) {
      console.log(`[WALLET] Adding initial credit for user ${user.id}`)
      const { data: existingWallet } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (!existingWallet) {
        await supabaseAdmin.from("wallets").insert({
          user_id: user.id,
          balance: INITIAL_FREE_CREDIT
        })
      }
    }

    // ۶. لاگین نهایی
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: passwordToUse
      })

    if (signInError) throw signInError
    if (!signInData.session) throw new Error("نشست کاربری ایجاد نشد")

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
