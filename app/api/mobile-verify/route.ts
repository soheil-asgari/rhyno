import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"
import { createClient as createSSRClient } from "@/lib/supabase/server"

const toE164 = (phone: string) => {
  if (phone.startsWith("0")) {
    return `+98${phone.slice(1)}`
  }
  if (!phone.startsWith("+")) {
    return `+98${phone}`
  }
  return phone
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

    await supabaseAdmin.from("otp_codes").delete().eq("id", latestOtp.id)

    const { data: users, error: listError } =
      await supabaseAdmin.auth.admin.listUsers()
    if (listError) throw new Error(`Failed to list users: ${listError.message}`)

    let user = users.users.find(
      u => u.email === fakeEmail || u.user_metadata?.phone === phoneE164
    )

    const passwordToUse = generateStrongPassword()

    if (!user) {
      const { data: newUserData, error: signUpError } =
        await supabaseAdmin.auth.admin.createUser({
          email: fakeEmail,
          password: passwordToUse,
          email_confirm: true,
          user_metadata: {
            phone: phoneE164
          }
        })

      if (signUpError)
        throw new Error(`Failed to create user: ${signUpError.message}`)
      user = newUserData.user
    } else {
      if (!user.email || user.email !== fakeEmail) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          email: fakeEmail,
          email_confirm: true,
          password: passwordToUse,
          user_metadata: { ...user.user_metadata, phone: phoneE164 }
        })
      } else {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: passwordToUse,
          user_metadata: { ...user.user_metadata, phone: phoneE164 }
        })
      }
    }

    if (user) {
      await supabaseAdmin
        .from("profiles")
        .update({ phone: phoneE164 })
        .eq("user_id", user.id)
    }

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: passwordToUse
      })

    if (signInError) throw signInError
    if (!signInData.session) throw new Error("Session not created")

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
