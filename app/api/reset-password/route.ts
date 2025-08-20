// File: /app/api/reset-password/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { Database } from "@/supabase/types" // مسیر را با پروژه خود تطبیق دهید

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get("email"))
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({
    cookies: () => cookieStore
  })
  const redirectUrl = new URL("/login", request.url)

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${new URL(request.url).origin}/auth/callback?next=/login/password`
  })

  if (error) {
    redirectUrl.searchParams.set("message", error.message)
    return NextResponse.redirect(redirectUrl)
  }

  redirectUrl.searchParams.set("message", "Check email to reset password")
  return NextResponse.redirect(redirectUrl)
}
