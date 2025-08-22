// app/[locale]/login/page.tsx

import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { createClient } from "@/lib/supabase/server"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

// =================================================================
//  ✅ راه‌حل مشکل اول: تمام سرور اکشن‌ها به بیرون از کامپوننت منتقل شدند
// =================================================================

const signIn = async (formData: FormData) => {
  "use server"

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const supabase = await createClient() // ساخت کلاینت جدید در داخل اکشن

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return redirect(`/login?message=${error.message}`)
  }

  const { data: homeWorkspace, error: homeWorkspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("is_home", true)
    .single()

  if (!homeWorkspace) {
    throw new Error(
      homeWorkspaceError?.message || "An unexpected error occurred"
    )
  }

  return redirect(`/${homeWorkspace.id}/chat`)
}

const signUp = async (formData: FormData) => {
  "use server"
  // منطق کامل signUp شما در اینجا قرار می‌گیرد
  // فقط مطمئن شوید که در ابتدای آن supabase را می‌سازید:
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  // ... بقیه منطق signUp شما ...

  const { error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) {
    console.error(error)
    return redirect(`/login?message=${error.message}`)
  }

  return redirect("/setup")
}

const handleResetPassword = async (formData: FormData) => {
  "use server"
  // در تابع handleResetPassword
  const origin = (await headers()).get("origin") // صحیح
  const email = formData.get("email") as string
  const supabase = await createClient() // ساخت کلاینت جدید در داخل اکشن

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/login/password`
  })

  if (error) {
    return redirect(`/login?message=${error.message}`)
  }

  return redirect("/login?message=Check email to reset password")
}

// =================================================================
//  کامپوننت اصلی صفحه
// =================================================================

export default async function Login({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // ✅ راه‌حل مشکل دوم: پراپرتی searchParams await می‌شود
  const message = searchParams?.message
  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form
        className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2"
        action={signIn}
      >
        <Brand />

        <Label className="text-md mt-4" htmlFor="email">
          Email
        </Label>
        <Input
          className="mb-3 rounded-md border bg-inherit px-4 py-2"
          name="email"
          placeholder="you@example.com"
          required
        />

        <Label className="text-md" htmlFor="password">
          Password
        </Label>
        <Input
          className="mb-6 rounded-md border bg-inherit px-4 py-2"
          type="password"
          name="password"
          placeholder="••••••••"
        />

        <SubmitButton className="mb-2 rounded-md bg-blue-700 px-4 py-2 text-white">
          Login
        </SubmitButton>

        <SubmitButton
          formAction={signUp}
          className="border-foreground/20 mb-2 rounded-md border px-4 py-2"
        >
          Sign Up
        </SubmitButton>

        <div className="text-muted-foreground mt-1 flex justify-center text-sm">
          <span className="mr-1">Forgot your password?</span>
          <button
            formAction={handleResetPassword}
            className="text-primary ml-1 underline hover:opacity-80"
          >
            Reset
          </button>
        </div>

        {searchParams?.message && (
          <p className="bg-foreground/10 text-foreground mt-4 p-4 text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
