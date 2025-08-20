import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { createClient } from "@/lib/supabase/server"
import { Database } from "@/supabase/types"
import { createServerClient } from "@supabase/ssr"
import { get } from "@vercel/edge-config"
import { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Login"
}
// یک تابع کمکی برای ترجمه خطاهای Supabase
const translateSupabaseError = (errorMessage: string): string => {
  const lowerCaseError = errorMessage.toLowerCase()
  console.log("Supabase Error Message Received:", errorMessage)

  // این کنسول لاگ به شما کمک می‌کند اگر خطای جدیدی رخ داد، آن را ببینید
  console.log("Original Supabase Error for Translation:", lowerCaseError)

  if (lowerCaseError.includes("invalid login credentials")) {
    return "ایمیل یا رمز عبور وارد شده صحیح نیست."
  }
  if (lowerCaseError.includes("user already registered")) {
    return "این ایمیل قبلاً ثبت‌نام شده است. لطفاً وارد شوید."
  }
  if (lowerCaseError.includes("password should be at least")) {
    return "رمز عبور شما باید حداقل ۶ کاراکتر باشد."
  }
  if (lowerCaseError.includes("email not confirmed")) {
    return "ایمیل شما هنوز تایید نشده است. لطفاً صندوق ورودی خود را بررسی کنید."
  }
  // ... می‌توانید خطاهای دیگر را به همین شکل اضافه کنید

  // پیام پیش‌فرض برای خطاهایی که ترجمه نشده‌اند
  return "یک خطای پیش‌بینی‌نشده رخ داد. لطفاً دوباره تلاش کنید."
}
export default async function Login({
  searchParams
}: {
  searchParams: { message: string }
}) {
  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )
  const session = (await supabase.auth.getSession()).data.session

  if (session) {
    const { data: homeWorkspace, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("is_home", true)
      .single()

    if (!homeWorkspace) {
      throw new Error(error.message)
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  const signIn = async (formData: FormData) => {
    "use server"

    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // مرحله ۱: تلاش برای ورود کاربر
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    // اگر در مرحله ورود خطا وجود داشت
    if (error) {
      const message = translateSupabaseError(error.message)
      const safeMessage = message.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      return redirect(`/login?message=${encodeURIComponent(safeMessage)}`)
    }

    // مرحله ۲: اگر ورود موفق بود، workspace کاربر را پیدا کن
    const { data: homeWorkspace, error: homeWorkspaceError } = await supabase
      .from("workspaces")
      .select("*")
      // 👇 این خط به درستی اصلاح شده است
      .eq("user_id", data.user.id)
      .eq("is_home", true)
      .single()

    if (homeWorkspaceError) {
      // اگر در گرفتن workspace خطا رخ داد، یک پیام عمومی نمایش بده
      throw new Error("پس از ورود، در دریافت اطلاعات حساب شما خطایی رخ داد.")
    }

    // مرحله ۳: کاربر را به داشبورد هدایت کن
    return redirect(`/${homeWorkspace.id}/chat`)
  }

  const getEnvVarOrEdgeConfigValue = async (name: string) => {
    "use server"
    if (process.env.EDGE_CONFIG) {
      return await get<string>(name)
    }

    return process.env[name]
  }

  const signUp = async (formData: FormData) => {
    "use server"

    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // ثبت‌نام کاربر
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
        options: {
          // اگر می‌خوای تایید ایمیل فعال باشد، این گزینه را باز کن
          // emailRedirectTo: `${origin}/auth/callback?next=/login`
        }
      }
    )

    if (signUpError) {
      // ۱. خطا را به تابع ترجمه می‌دهیم تا پیام فارسی را برگرداند.
      const message = translateSupabaseError(signUpError.message)

      // ۲. کاربر را با پیام ترجمه‌شده به صفحه لاگین هدایت می‌کنیم.
      return redirect(`/login?message=${encodeURIComponent(message)}`)
    }

    // اگر خطایی وجود نداشت، کد به اجرای خود ادامه می‌دهد...
    if (signUpData.user?.confirmation_sent_at) {
      return redirect(
        `/login?message=${encodeURIComponent(
          "ثبت‌نام موفق بود. لطفاً ایمیل خود را برای تکمیل فرآیند ورود بررسی کنید."
        )}`
      )
    }

    // لاگین خودکار بعد از ثبت‌نام (برای تایید ایمیل غیر فعال)
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password
      })
    console.log("SIGN IN RESULT", { signInData, signInError })
    if (signInError) {
      const message = signInError.message.includes("Invalid login credentials")
        ? "ایمیل یا پسورد اشتباه است. اگر هنوز ثبت‌نام نکرده‌اید، لطفا ثبت‌نام کنید."
        : signInError.message
      return redirect(`/login?message=${encodeURIComponent(message)}`)
    }

    const userId = signInData.user?.id
    if (!userId) {
      throw new Error("شناسه کاربر پس از ثبت‌نام یافت نشد")
    }

    // هدایت به صفحه setup یا داشبورد
    return redirect(`/setup`)
  }

  const handleResetPassword = async (formData: FormData) => {
    "use server"

    const origin = headers().get("origin")
    const email = formData.get("email") as string
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/login/password`
    })

    if (error) {
      let message = "خطایی رخ داد. لطفاً دوباره تلاش کنید."

      if (error.message.includes("Invalid login credentials")) {
        message = "ایمیل یا رمز عبور وارد شده صحیح نیست."
      }

      // می‌توانید خطاهای دیگر را هم به همین شکل اضافه کنید
      // else if (error.message.includes("Another error text")) { ... }

      return redirect(`/login?message=${encodeURIComponent(message)}`)
    }

    return redirect("/login?message=Check email to reset password")
  }

  return (
    // برای نمایش صحیح فونت فارسی و استایل‌ها، بهتر است در فایل layout اصلی خود dir="rtl" را به تگ <html> اضافه کنید.
    <div className="font-vazir flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form
        className="animate-in text-foreground font-vazir flex w-full flex-1 flex-col justify-center gap-2"
        action={signIn}
        method="post"
      >
        <Brand />

        {/* لیبل ایمیل */}
        <Label className="text-md mt-4 text-right" htmlFor="email">
          ایمیل
        </Label>
        <Input
          className="font-vazir mb-3 rounded-md border bg-inherit px-4 py-2 text-right" // text-right برای ورودی فارسی
          name="email"
          placeholder="shoma@example.com"
          required
        />

        {/* لیبل رمز عبور */}
        <Label className="text-md text-right" htmlFor="password">
          رمز عبور
        </Label>
        <Input
          className="font-vazir mb-6 rounded-md border bg-inherit px-4 py-2 text-right" // text-right برای ورودی فارسی
          type="password"
          name="password"
          placeholder="••••••••"
          required // بهتر است فیلد پسورد هم required باشد
        />

        <SubmitButton
          type="submit"
          formAction={signIn}
          className="font-vazir mb-2 rounded-md bg-blue-700 px-4 py-2 text-white"
        >
          ورود
        </SubmitButton>

        <SubmitButton
          type="submit"
          formAction={signUp}
          className="border-foreground/20 font-vazir mb-2 rounded-md border px-4 py-2"
        >
          ثبت‌نام
        </SubmitButton>

        {/* بخش بازیابی رمز عبور */}
        <div className="text-muted-foreground font-vazir mt-1 flex justify-center text-sm">
          <span className="me-1">رمز عبور خود را فراموش کرده‌اید؟</span>{" "}
          {/* me-1 برای فاصله در حالت راست‌چین */}
          <button
            formAction={handleResetPassword}
            className="text-primary font-vazir ms-1 underline hover:opacity-80" // ms-1 برای فاصله در حالت راست‌چین
          >
            بازیابی
          </button>
        </div>

        {/* نمایش پیام‌های خطا یا موفقیت */}
        {searchParams?.message && (
          <p className="bg-foreground/10 text-foreground font-vazir mt-4 p-4 text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
