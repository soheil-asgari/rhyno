"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function loginEnterpriseUser(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  console.log("--- LOGIN ATTEMPT STARTED ---") // لاگ شروع
  console.log("Email:", email)

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // ۱. احراز هویت
  const {
    data: { user },
    error
  } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error || !user) {
    console.log("Login Failed:", error?.message)
    return { error: "ایمیل یا رمز عبور اشتباه است" }
  }

  console.log("User Authenticated. ID:", user.id)

  // ۲. دریافت پروفایل
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, display_name") // مطمئن شوید role را می‌گیرید
    .eq("user_id", user.id)
    .single()

  if (profileError) {
    console.error("Profile Fetch Error:", profileError)
  } else {
    console.log("Fetched Profile:", profile)
  }

  // ۳. دریافت ورک‌اسپیس
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (workspaceError) {
    console.error("Workspace Fetch Error:", workspaceError)
  } else {
    console.log("Fetched Workspace ID:", workspace?.id)
  }

  // اگر ورک‌اسپیس نداشت
  if (!workspace) {
    console.log("Redirecting to Setup (No Workspace found)")
    return redirect("/setup")
  }

  const role = (profile as any)?.role || "payer"
  console.log("DECIDED ROLE:", role) // <--- مهمترین لاگ

  // ۴. ریدایرکت نهایی
  switch (role) {
    // مدیر عامل -> داشبورد هوش تجاری (BI)
    case "ceo":
      return redirect(`/enterprise/${workspace.id}/dashboard`)

    // مدیر مالی -> داشبورد گزارشات مالی
    case "finance_manager":
      return redirect(`/enterprise/${workspace.id}/finance/dashboard`)

    // مسئول پیگیری -> کارتابل وظایف
    case "finance_staff":
      return redirect(`/enterprise/${workspace.id}/finance/cartable`)

    // مسئول واریز -> صفحه آپلود
    case "payer":
      return redirect(`/enterprise/${workspace.id}/finance/upload`)

    // ادمین سیستم
    case "admin":
      return redirect(`/enterprise/${workspace.id}/settings`)

    default:
      return redirect(`/enterprise/${workspace.id}/dashboard`)
  }
}
