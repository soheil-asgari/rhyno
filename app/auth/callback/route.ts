// مسیر فایل: app/auth/callback/route.ts

import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (code) {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    // اگر تبادل کد با موفقیت انجام شد (کاربر با گوگل یا هر روش OAuth دیگر لاگین کرد)
    if (!exchangeError) {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (session) {
        // به دنبال ورک‌اسپیس کاربر بگرد
        const { data: homeWorkspace } = await supabase
          .from("workspaces")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("is_home", true)
          .single()

        // اگر داشت، به آنجا هدایتش کن
        if (homeWorkspace) {
          return NextResponse.redirect(`${origin}/${homeWorkspace.id}/chat`)
        }
      }

      // اگر کاربر جدید بود یا ورک‌اسپیس نداشت، به صفحه ساخت آن برو
      return NextResponse.redirect(`${origin}/setup`)
    }
  }

  // اگر به هر دلیلی خطا رخ داد، به صفحه لاگین برگرد
  return NextResponse.redirect(
    `${origin}/login?message=Could not authenticate user`
  )
}
