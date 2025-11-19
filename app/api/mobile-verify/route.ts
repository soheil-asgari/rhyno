import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createClient as createSSRClient } from "@/lib/supabase/server"

// --- تنظیمات ---
const INITIAL_FREE_CREDIT = 0.5 // مبلغ شارژ اولیه

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
  const fakeEmail = `${phoneE164.replace("+", "")}@placeholder.rhyno`

  const cookieStore = cookies()
  const supabase = createSSRClient(cookieStore)
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // ۱. بررسی کد OTP
    const { data: latestOtp, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone", phoneE164)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError || !latestOtp)
      return NextResponse.json({ message: "کد نامعتبر است" }, { status: 400 })

    const isValid = await bcrypt.compare(otp, latestOtp.hashed_otp)
    if (!isValid)
      return NextResponse.json({ message: "کد صحیح نیست" }, { status: 400 })

    if (new Date(latestOtp.expires_at) < new Date())
      return NextResponse.json({ message: "کد منقضی شده" }, { status: 400 })

    await supabaseAdmin.from("otp_codes").delete().eq("id", latestOtp.id)

    // ۲. پیدا کردن یا ساخت کاربر
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    let user = users.users.find(
      u => u.email === fakeEmail || u.user_metadata?.phone === phoneE164
    )

    const passwordToUse = generateStrongPassword()
    let isNewUser = false

    if (!user) {
      isNewUser = true
      console.log(`[AUTH] Creating new user: ${fakeEmail}`)
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: fakeEmail,
          password: passwordToUse,
          email_confirm: true,
          user_metadata: { phone: phoneE164 }
        })
      if (createError) throw createError
      user = newUser.user
    } else {
      // آپدیت کاربر قدیمی
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: fakeEmail,
        email_confirm: true,
        password: passwordToUse,
        user_metadata: { ...user.user_metadata, phone: phoneE164 }
      })
    }

    if (!user) throw new Error("User creation failed")

    // ۳. تنظیمات پروفایل و کیف پول (اصلاح شده برای حل تداخل با Trigger)

    // الف) آپدیت شماره در پروفایل
    // تلاش می‌کنیم پروفایل موجود (که توسط Trigger ساخته شده) را آپدیت کنیم
    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({ phone: phoneE164 })
      .eq("user_id", user.id)

    // اگر پروفایلی وجود نداشت (Trigger کار نکرده بود)، یکی می‌سازیم
    if (updateProfileError || isNewUser) {
      // برای اطمینان یک upsert هم انجام می‌دهیم که اگر آپدیت بالا به هر دلیلی نگرفت، اینجا درست شود
      await supabaseAdmin.from("profiles").upsert(
        {
          user_id: user.id,
          phone: phoneE164,
          username: `user_${phoneE164.slice(-4)}_${Math.floor(Math.random() * 10000)}`,
          // مقادیر پیش‌فرض برای جلوگیری از خطای نال بودن
          display_name: phoneE164,
          bio: ""
        },
        { onConflict: "user_id" }
      )
    }

    // ب) اعمال شارژ اولیه (فقط برای کاربر جدید)
    if (isNewUser) {
      console.log(`[WALLET] Setting initial credit for ${user.id}`)

      // اینجا به جای insert، از upsert استفاده می‌کنیم تا اگر Trigger قبلاً با 0 ساخته بود، آن را 50000 کنیم
      const { error: walletError } = await supabaseAdmin.from("wallets").upsert(
        {
          user_id: user.id,
          balance: INITIAL_FREE_CREDIT // 👈 این عدد جایگزین 0 می‌شود
        },
        { onConflict: "user_id" }
      )

      if (walletError) {
        console.error("[WALLET ERROR]", walletError)
        // تیر آخر: اگر upsert هم ارور داد (کم پیش می‌آید)، مستقیم update می‌زنیم
        await supabaseAdmin
          .from("wallets")
          .update({ balance: INITIAL_FREE_CREDIT })
          .eq("user_id", user.id)
      }
    }

    // ۴. لاگین
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: passwordToUse
      })

    if (signInError) throw signInError

    return NextResponse.json({
      access_token: signInData.session?.access_token,
      refresh_token: signInData.session?.refresh_token
    })
  } catch (error: any) {
    console.error("[ERROR]", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
