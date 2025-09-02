// مسیر فایل: app/auth/callback/route.ts

import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?message=No code provided`)
  }

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // تبادل کد با session
  const { data: exchangeData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?message=${encodeURIComponent(exchangeError.message)}`
    )
  }

  const { session, user } = exchangeData || {}

  if (!session || !user) {
    return NextResponse.redirect(`${origin}/login?message=No session found`)
  }

  // بررسی اینکه آیا کاربر جدید است (برای اضافه کردن 1$ خوش‌آمدگویی)
  const { data: walletData } = await supabase
    .from("wallets")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!walletData) {
    // اضافه کردن 1$ خوش‌آمدگویی
    await supabase.from("wallets").insert({
      user_id: user.id,
      amount_usd: 1,
      description: "خوش‌آمدگویی 1$"
    })
  }

  // پیدا کردن ورک‌اسپیس اصلی کاربر
  const { data: homeWorkspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_home", true)
    .single()

  // هدایت به ورک‌اسپیس یا صفحه setup
  if (homeWorkspace) {
    return NextResponse.redirect(`${origin}/${homeWorkspace.id}/chat?welcome=1`)
  } else {
    return NextResponse.redirect(`${origin}/setup?welcome=1`)
  }
}
