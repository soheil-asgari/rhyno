// مسیر فایل: app/actions.ts

"use server"

import { createClient } from "@/lib/supabase/server" // مطمئن شوید مسیر درست است
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

// تابع برای ثبت‌نام
export async function signUp(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (password !== confirmPassword) {
    return redirect("/signup?message=Passwords do not match")
  }

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return redirect(`/signup?message=${encodeURIComponent(error.message)}`)
  }

  return redirect("/setup")
}

// تابع برای ورود/ثبت‌نام با گوگل
export async function signInWithGoogle() {
  const origin = headers().get("origin")
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`
    }
  })

  if (error) {
    // در صورت خطا بهتر است به صفحه ثبت‌نام بازگردد
    return redirect(`/signup?message=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    return redirect(data.url)
  }

  return redirect(`/signup?message=Could not get Google auth URL`)
}
