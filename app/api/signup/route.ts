// File: /app/api/signup/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { Database } from "@/supabase/types" // مسیر را با پروژه خود تطبیق دهید

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get("email"))
  const password = String(formData.get("password"))
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({
    cookies: () => cookieStore
  })

  // منطق Whitelist را در صورت نیاز اینجا اضافه کنید
  // ...

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // برای ارسال ایمیل تایید، این بخش را فعال کنید
      // emailRedirectTo: `${new URL(request.url).origin}/auth/callback`,
    }
  })

  if (error) {
    const redirectUrl = new URL("/login", request.url)
    redirectUrl.searchParams.set("message", error.message)
    return NextResponse.redirect(redirectUrl)
  }

  // پس از ثبت‌نام موفق، کاربر را به صفحه setup هدایت کنید
  return NextResponse.redirect(new URL("/setup", request.url))
}
