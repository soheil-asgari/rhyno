// File: /app/api/login/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { Database } from "@/supabase/types" // مسیر این فایل را با پروژه خود تطبیق دهید

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get("email"))
  const password = String(formData.get("password"))
  const cookieStore = cookies()

  const supabase = createRouteHandlerClient<Database>({
    cookies: () => cookieStore
  })

  // تلاش برای ورود کاربر
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  // اگر خطایی در ورود وجود داشت
  if (error) {
    const redirectUrl = new URL("/login", request.url)
    redirectUrl.searchParams.set("message", error.message)
    return NextResponse.redirect(redirectUrl)
  }

  // اگر ورود موفق بود، workspace کاربر را پیدا کن
  const { data: homeWorkspace, error: homeWorkspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("is_home", true)
    .single()

  if (homeWorkspaceError || !homeWorkspace) {
    const redirectUrl = new URL("/login", request.url)
    redirectUrl.searchParams.set(
      "message",
      "Login successful, but failed to find your workspace."
    )
    return NextResponse.redirect(redirectUrl)
  }

  // کاربر را به صفحه چت هدایت کن
  return NextResponse.redirect(
    new URL(`/${homeWorkspace.id}/chat`, request.url)
  )
}
