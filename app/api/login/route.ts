// File: /app/api/login/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { Database } from "@/supabase/types"

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = String(formData.get("email"))
  const password = String(formData.get("password"))
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({
    cookies: () => cookieStore
  })

  console.log("Login attempt for:", email) // <-- لاگش ۱

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    console.error("Supabase sign-in error:", error.message) // <-- لاگ خطا
    const redirectUrl = new URL("/login", request.url)
    redirectUrl.searchParams.set("message", error.message)
    return NextResponse.redirect(redirectUrl)
  }

  console.log("Sign-in successful for user:", data.user.id) // <-- لاگ ۲

  console.log("Attempting to find workspace for user...") // <-- لاگ ۳
  const { data: homeWorkspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("is_home", true)
    .single()

  if (workspaceError || !homeWorkspace) {
    console.error(
      "Workspace error:",
      workspaceError?.message || "Workspace not found"
    ) // <-- لاگ خطا
    const redirectUrl = new URL("/login", request.url)
    redirectUrl.searchParams.set("message", "Could not find your workspace.")
    return NextResponse.redirect(redirectUrl)
  }

  console.log("Workspace found:", homeWorkspace.id) // <-- لاگ ۴
  return NextResponse.redirect(
    new URL(`/${homeWorkspace.id}/chat`, request.url)
  )
}
