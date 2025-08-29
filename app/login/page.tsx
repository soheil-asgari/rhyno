import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { createClient } from "@/lib/supabase/server"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Metadata } from "next"
import { sendCustomOtpAction, verifyCustomOtpAction } from "./actions"
import OtpStep from "./OtpStep"

export const metadata: Metadata = {
  title: "ورود | Rhyno Chat"
}

const errorMessages: { [key: string]: string } = {
  invalid_credentials: "ایمیل یا رمز عبور نامعتبر است.",
  user_not_found: "کاربر یافت نشد.",
  invalid_code: "کد وارد شده نامعتبر یا اشتباه است.",
  expired_code: "کد منقضی شده است. لطفاً دوباره درخواست دهید.",
  send_otp_failed: "خطا در ارسال کد تایید. لطفاً لحظاتی دیگر تلاش کنید.",
  auth_failed: "خطا در فرآیند احراز هویت.",
  invalid_email: "فرمت ایمیل نامعتبر است.",
  invalid_password: "رمز عبور باید حداقل 6 کاراکتر باشد."
}

// ... سایر importها
// ... سایر importها
export default async function LoginPage({
  searchParams
}: {
  searchParams: {
    message?: string
    error?: string
    method?: "email" | "phone"
    step?: "otp"
    phone?: string
  }
}) {
  const cookieStore = cookies()
  cookieStore.getAll().forEach(cookie => {
    if (cookie.name.startsWith("sb-vkwgwiiesvyfcgaemeck-auth-token")) {
      cookieStore.delete(cookie.name)
      console.log("Deleted cookie:", cookie.name)
    }
  })
  const supabase = createClient(cookieStore)
  const {
    data: { session }
  } = await supabase.auth.getSession()

  console.log("searchParams:", JSON.stringify(searchParams))

  if (session) {
    console.log("Session exists, redirecting to /")
    return redirect("/")
  }

  let method: string | undefined
  let error: string | undefined
  try {
    method = searchParams.method
      ? decodeURIComponent(searchParams.method)
      : undefined
    error = searchParams.error
      ? decodeURIComponent(searchParams.error)
      : undefined
    console.log("Decoded method:", method, "Decoded error:", error)
  } catch (e) {
    console.error("Error decoding searchParams:", e)
    return redirect(`/login?error=${encodeURIComponent("invalid_params")}`)
  }

  const displayMessage = error
    ? errorMessages[error] || "یک خطای ناشناخته رخ داد."
    : searchParams.message

  // app/login/page.tsx
  const signIn = async (formData: FormData) => {
    "use server"
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    console.log("Form data:", { email, password })

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log("Invalid email format:", email)
      return redirect(
        `/login?method=email&error=${encodeURIComponent("invalid_email")}`
      )
    }
    if (password.length < 6) {
      console.log("Invalid password length:", password.length)
      return redirect(
        `/login?method=email&error=${encodeURIComponent("invalid_password")}`
      )
    }

    const cookieStore = cookies()
    console.log("Cookies before auth:", cookieStore.getAll())

    const supabase = createClient(cookieStore)
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (authError) {
      console.log("Supabase auth error:", authError.message)
      return redirect(
        `/login?method=email&error=${encodeURIComponent("invalid_credentials")}`
      )
    }

    console.log("Cookies after auth:", cookieStore.getAll())

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      console.log(
        "User error:",
        userError?.message || "User not found for email:",
        email
      )
      return redirect(
        `/login?method=email&error=${encodeURIComponent("user_not_found")}`
      )
    }

    console.log("User data:", {
      id: user.id,
      email: user.email,
      phone: user.phone
    })

    if (!user.phone) {
      console.log("User phone not set:", user.id)
      return redirect("/verify-phone")
    }

    const { data: homeWorkspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_home", true)
      .single()
    if (workspaceError || !homeWorkspace) {
      console.log(
        "Workspace error:",
        workspaceError?.message || "No home workspace found for user:",
        user.id
      )
      return redirect("/setup")
    }

    console.log("Home workspace:", {
      id: homeWorkspace.id,
      name: homeWorkspace.name
    })

    if (!homeWorkspace.id.match(/^[0-9a-fA-F-]{36}$/)) {
      console.error("Invalid workspace id:", homeWorkspace.id)
      return redirect(
        `/login?method=email&error=${encodeURIComponent("invalid_workspace_id")}`
      )
    }

    const redirectUrl = `/${homeWorkspace.id}/chat`
    console.log("Redirecting to:", redirectUrl)
    return redirect(redirectUrl)
  }

  const signInWithGoogle = async () => {
    "use server"
    const origin = headers().get("origin")
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` }
    })
    if (error) {
      console.log("Google auth error:", error.message)
      return redirect(`/login?message=${encodeURIComponent(error.message)}`)
    }
    if (data.url) {
      console.log("Redirecting to Google auth URL:", data.url)
      return redirect(data.url)
    }
  }

  const renderContent = () => {
    if (!method) {
      return (
        <>
          <h1 className="font-vazir text-center text-2xl font-bold text-white">
            ورود به حساب کاربری
          </h1>
          <p className="font-vazir text-muted-foreground mb-6 text-center text-sm">
            یک روش برای ادامه انتخاب کنید
          </p>
          <a
            href="/login?method=email"
            className="font-vazir mb-2 w-full rounded-md bg-blue-700 px-4 py-2 text-center text-white hover:opacity-90"
          >
            ادامه با ایمیل
          </a>
          <div className="relative my-2">
            <div className="font-vazir absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background text-muted-foreground px-2">
                یا
              </span>
            </div>
          </div>
          <a
            href="/login?method=phone"
            className="font-vazir mb-2 w-full rounded-md bg-green-600 px-4 py-2 text-center text-white hover:opacity-90"
          >
            ادامه با شماره موبایل
          </a>
          <div className="relative my-2">
            <div className="font-vazir absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background text-muted-foreground px-2">
                یا
              </span>
            </div>
          </div>
          <SubmitButton
            formAction={signInWithGoogle}
            formNoValidate={true}
            className="font-vazir border-foreground/20 flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2"
          >
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              ></path>
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              ></path>
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              ></path>
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              ></path>
              <path d="M1 1h22v22H1z" fill="none"></path>
            </svg>
            ورود با گوگل
          </SubmitButton>
          <div className="font-vazir mt-6 text-center text-sm">
            <span className="text-muted-foreground">حساب کاربری ندارید؟ </span>
            <a href="/signup" className="font-bold underline hover:opacity-80">
              ثبت‌نام کنید
            </a>
          </div>
        </>
      )
    }
    if (method === "email") {
      return (
        <>
          <Label className="font-vazir text-md text-right" htmlFor="email">
            ایمیل
          </Label>
          <Input
            className="font-vazir mb-3 rounded-md border bg-inherit px-4 py-2"
            name="email"
            placeholder="you@example.com"
            required
          />
          <Label className="font-vazir text-md text-right" htmlFor="password">
            رمز عبور
          </Label>
          <Input
            className="font-vazir mb-6 rounded-md border bg-inherit px-4 py-2"
            type="password"
            name="password"
            placeholder="••••••••"
            required
          />
          <SubmitButton
            formAction={signIn}
            className="mb-2 rounded-md bg-blue-700 px-4 py-2 text-white"
          >
            ورود
          </SubmitButton>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">حساب کاربری ندارید؟ </span>
            <a href="/signup" className="font-bold underline hover:opacity-80">
              ثبت‌نام کنید
            </a>
          </div>
        </>
      )
    }
    if (method === "phone") {
      return searchParams.step === "otp" ? (
        <OtpStep
          phone={searchParams.phone || ""}
          formAction={verifyCustomOtpAction}
        />
      ) : (
        <>
          <input type="hidden" name="referer" value="/login" />
          <Label className="font-vazir text-md text-right" htmlFor="phone">
            شماره موبایل
          </Label>
          <Input
            id="phone"
            name="phone"
            placeholder="09xxxxxxxxx"
            required
            className="font-vazir mb-3 rounded-md border bg-inherit px-4 py-2"
          />
          <SubmitButton
            formAction={sendCustomOtpAction}
            className="font-vazir rounded-md bg-blue-700 px-4 py-2 text-white"
          >
            ارسال کد
          </SubmitButton>
        </>
      )
    }
    return null
  }

  const messageClasses = error
    ? "bg-red-900/50 text-white"
    : "bg-foreground/10 text-foreground"

  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2">
        <div className="mb-6 flex justify-center">
          <Brand />
        </div>
        {renderContent()}
        {method && (
          <a
            href="/login"
            className="font-vazir text-muted-foreground mt-4 text-center text-sm font-bold hover:underline"
          >
            &larr; بازگشت به روش‌های ورود
          </a>
        )}
        {displayMessage && (
          <p
            className={`font-vazir mt-4 rounded-md p-4 text-center text-sm ${messageClasses}`}
          >
            {displayMessage}
          </p>
        )}
      </form>
    </div>
  )
}
