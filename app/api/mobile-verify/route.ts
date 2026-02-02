import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createClient as createSSRClient } from "@/lib/supabase/server"

// --- تنظیمات ---
const INITIAL_FREE_CREDIT = 1.0

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
  // ساخت ایمیل فیک بر اساس شماره موبایل (برای ثبات)
  const fakeEmail = `${phoneE164.replace("+", "")}@placeholder.rhyno`

  const cookieStore = cookies()
  const supabase = createSSRClient(cookieStore)
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // ۱. بررسی OTP
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

    // ۲. مدیریت کاربر (جستجوی بهینه + ثبت‌نام یا آپدیت)
    let user = null
    let isNewUser = false

    // الف) تلاش برای یافتن کاربر از طریق جدول پروفایل (روش مطمئن)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("phone", phoneE164)
      .single()

    if (existingProfile) {
      // اگر پروفایل وجود داشت، یوزر Auth را بر اساس ID می‌گیریم
      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(existingProfile.user_id)
      if (!userError && userData.user) {
        user = userData.user
      }
    }

    // ب) اگر در پروفایل پیدا نشد، ممکن است کاربر وجود داشته باشد ولی پروفایل نداشته باشد (مثلاً کاربران خیلی قدیمی)
    // نکته: listUsers محدودیت ۵۰ تایی دارد، پس روی آن حساب نمی‌کنیم.
    // در عوض سعی می‌کنیم کاربر را بسازیم، اگر ارور داد یعنی وجود دارد و باید پیدایش کنیم.

    const passwordToUse = generateStrongPassword()

    if (!user) {
      // تلاش برای ساخت کاربر جدید
      // از آنجایی که ایمیل را بر اساس شماره می‌سازیم، اگر کاربر وجود داشته باشد، این دستور ارور می‌دهد
      try {
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: fakeEmail,
            password: passwordToUse,
            email_confirm: true,
            user_metadata: { phone: phoneE164 }
          })

        if (createError) {
          // اگر ارور "ایمیل تکراری" بود، یعنی کاربر وجود دارد ولی ما پیدایش نکرده بودیم
          if (
            createError.message.includes("email") ||
            createError.status === 422
          ) {
            // در این حالت خاص و نادر، چون نمی‌توانیم با ایمیل جستجو کنیم (متدش وجود ندارد)،
            // مجبوریم یک بار لیست را با پیج‌بندی زیاد بگیریم یا فرض کنیم همان پروفایل باید سینک می‌شده.
            // اما راه بهتر: از آنجایی که ایمیل را خودمان ساختیم، می‌توانیم مطمئن باشیم کاربر هست.
            // متاسفانه Supabase Admin API متد getUserByEmail ندارد.
            // راه حل نهایی: فراخوانی RPC برای گرفتن ID از روی ایمیل (اگر دسترسی دیتابیس دارید)
            // یا موقتاً افزایش limit در listUsers فقط برای این سناریوی خاص:
            const { data: searchUsers } =
              await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
            user = searchUsers.users.find(u => u.email === fakeEmail)

            if (!user)
              throw new Error("کاربر یافت نشد و ساخت آن هم با خطا مواجه شد.")
          } else {
            throw createError
          }
        } else {
          user = newUser.user
          isNewUser = true
        }
      } catch (e) {
        throw e
      }
    }

    if (!user) throw new Error("User failed to create/load")

    // اگر کاربر قدیمی است، پسوردش را آپدیت می‌کنیم تا بتواند لاگین کند
    if (!isNewUser) {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email: fakeEmail,
        email_confirm: true,
        password: passwordToUse,
        user_metadata: { ...user.user_metadata, phone: phoneE164 }
      })
    }

    // ۳. ثبت اجباری شماره موبایل (فقط برای کاربران جدید)
    if (isNewUser) {
      const { error: rpcError } = await supabaseAdmin.rpc(
        "force_update_phone",
        {
          user_id: user.id,
          new_phone: phoneE164
        }
      )
      if (rpcError) console.error("[RPC ERROR]", rpcError)
    }

    // ۴. آپدیت پروفایل و کیف پول (باقی کد مثل قبل)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ phone: phoneE164 })
      .eq("user_id", user.id)

    if (profileError || isNewUser) {
      await supabaseAdmin.from("profiles").upsert(
        {
          user_id: user.id,
          phone: phoneE164,
          username: `user_${phoneE164.slice(-4)}_${Math.floor(Math.random() * 10000)}`,
          display_name: phoneE164,
          bio: ""
        },
        { onConflict: "user_id" }
      )
    }

    if (isNewUser) {
      const { error: walletError } = await supabaseAdmin.from("wallets").upsert(
        {
          user_id: user.id,
          balance: INITIAL_FREE_CREDIT
        },
        { onConflict: "user_id" }
      )
      if (walletError) {
        await supabaseAdmin
          .from("wallets")
          .update({ balance: INITIAL_FREE_CREDIT })
          .eq("user_id", user.id)
      }
    }

    // ۵. لاگین
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
