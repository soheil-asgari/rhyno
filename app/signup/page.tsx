import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { createClient } from "@/lib/supabase/server"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { Metadata } from "next"

import AnimationHero from "./AnimationHero"

export const metadata: Metadata = {
  title: "ثبت نام | Rhyno Chat"
}

export default async function SignupPage({
  searchParams
}: {
  searchParams: {
    message?: string
    method?: "email" | "phone"
    step?: "otp"
    phone?: string
  }
}) {
  // --------------------------------------------------------------------------
  // 🔹 تعریف تمام Server Actions برای ثبت‌نام
  // --------------------------------------------------------------------------

  const signUpWithEmail = async (formData: FormData) => {
    "use server"
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    // ابتدا چک کن رمزها مطابقت دارند
    if (password !== confirmPassword) {
      return redirect(
        `/signup?method=email&message=${encodeURIComponent(
          "رمزهای عبور با یکدیگر مطابقت ندارند."
        )}`
      )
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // ثبت نام کاربر
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password
      }
    )

    if (signUpError || !signUpData.user) {
      return redirect(
        `/signup?method=email&message=${encodeURIComponent(
          "ثبت نام با این ایمیل امکان‌پذیر نیست."
        )}`
      )
    }

    // بعد از ثبت نام موفق، 1$ خوش آمدگویی اضافه کن
    // await supabase.from("wallets").insert({
    //   user_id: signUpData.user.id,
    //   amount_usd: 1,
    //   description: "خوش‌آمدگویی 1$"
    // })

    // return redirect(`/setup?welcome=1`) // هدایت به صفحه راه‌اندازی
  }

  const signUpWithGoogle = async () => {
    "use server"
    const origin = headers().get("origin") || process.env.NEXT_PUBLIC_SITE_URL
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` } // مسیر callback
    })

    if (error) {
      return redirect(`/signup?message=${encodeURIComponent(error.message)}`)
    }

    // کاربر هنوز به callback هدایت نشده، بنابراین اینجا نمی‌توان ۱$ اضافه کرد
    if (data.url) {
      return redirect(data.url)
    }
  }

  const sendOtpForSignUp = async (formData: FormData) => {
    "use server"
    const phone = formData.get("phone") as string

    // اعتبارسنجی شماره
    if (!/^09\d{9}$/.test(phone)) {
      return redirect(
        `/signup?method=phone&message=${encodeURIComponent("شماره موبایل نامعتبر است")}`
      )
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // بررسی تکراری نبودن شماره
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .single()

    if (existingUser) {
      return redirect(
        `/signup?method=phone&message=${encodeURIComponent("این شماره قبلاً ثبت شده است")}`
      )
    }

    // ارسال OTP (مثال: با Twilio یا سرویس داخلی)
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    await supabase.from("otp_codes").insert({
      phone,
      hashed_otp: otp, // ✅ اصلاح شد: نام فیلد با دیتابیس مطابقت دارد
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // ✅ اصلاح شد: به string تبدیل شد
    })

    const message = "کد برای شما ارسال شد ✅"
    redirect(
      `/signup?method=phone&step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}`
    )
  }

  const verifyOtpForSignUp = async (formData: FormData) => {
    "use server"
    const phone = formData.get("phone") as string
    const otp = formData.get("otp") as string // دریافت کد وارد شده توسط کاربر

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // مرحله ۱: کد OTP را در دیتابیس پیدا و اعتبارسنجی کن
    const { data: otpData, error: otpError } = await supabase
      .from("otp_codes")
      .select("id, expires_at")
      .eq("phone", phone)
      .eq("code", otp)
      .single()

    // اگر کد اشتباه بود یا خطایی رخ داد، به کاربر اطلاع بده
    if (otpError || !otpData) {
      const message = "کد واردشده نادرست است ❌"
      return redirect(
        `/signup?method=phone&step=otp&phone=${encodeURIComponent(
          phone
        )}&message=${encodeURIComponent(message)}`
      )
    }

    // اگر کد منقضی شده بود
    if (new Date(otpData.expires_at) < new Date()) {
      const message = "کد واردشده منقضی شده است. لطفاً دوباره تلاش کنید."
      return redirect(
        `/signup?method=phone&message=${encodeURIComponent(message)}`
      )
    }

    // مرحله ۲: کاربر جدید را در سیستم auth سوپابیس بساز
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        phone: phone,
        // برای ثبت‌نام با شماره موبایل، سوپابیس به یک رمز عبور نیاز دارد.
        // ما یک رمز موقت و تصادفی ایجاد می‌کنیم چون کاربر با OTP وارد می‌شود.
        password: Math.random().toString(36).slice(-12)
      }
    )

    if (signUpError || !signUpData.user) {
      const message =
        signUpError?.message === "User already registered"
          ? "این شماره قبلاً ثبت شده است."
          : "خطایی در ساخت حساب کاربری رخ داد."
      return redirect(
        `/signup?method=phone&message=${encodeURIComponent(message)}`
      )
    }

    // مرحله ۳: هدیه خوش‌آمدگویی را به کیف پول کاربر اضافه کن
    const newUserId = signUpData.user.id
    await supabase.from("wallets").insert({
      user_id: newUserId,
      amount_usd: 0.1,
      description: "خوش‌آمدگویی ۱ دلاری ثبت‌نام با موبایل"
    })

    // اختیاری: کد OTP استفاده شده را از دیتابیس پاک کن
    await supabase.from("otp_codes").delete().eq("id", otpData.id)

    // مرحله ۴: کاربر را به صفحه راه‌اندازی هدایت کن
    return redirect(`/setup?welcome=1`)
  }

  // --------------------------------------------------------------------------
  // 🔹 رندر کردن UI بر اساس انتخاب کاربر
  // --------------------------------------------------------------------------
  const renderContent = () => {
    if (!searchParams.method) {
      return (
        <>
          <h1 className="font-vazir text-center text-2xl font-bold text-white">
            ساخت حساب کاربری
          </h1>
          <p className="font-vazir mb-6 text-center text-sm text-gray-400">
            یک روش برای ثبت نام انتخاب کنید
          </p>

          <a
            href="/signup?method=email"
            className="font-vazir mb-2 w-full rounded-md bg-blue-700 px-4 py-2 text-center text-white hover:opacity-90"
          >
            ادامه با ایمیل
          </a>
          <div className="relative my-2">
            <div className="font-vazir absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="font-vazir bg-background text-muted-foreground px-2">
                یا
              </span>
            </div>
          </div>
          <a
            href="/signup?method=phone"
            className=" font-vazir mb-2 w-full rounded-md bg-green-600 px-4 py-2 text-center text-white hover:opacity-90"
          >
            ادامه با شماره موبایل
          </a>
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="font-vazir bg-background text-muted-foreground px-2">
                یا
              </span>
            </div>
          </div>
          <SubmitButton
            formAction={signUpWithGoogle}
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
            ثبت نام با گوگل
          </SubmitButton>
        </>
      )
    }
    if (searchParams.method === "email") {
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
            className="font-vazir mb-3 rounded-md border bg-inherit px-4 py-2"
            type="password"
            name="password"
            placeholder="••••••••"
            required
          />
          <Label
            className="font-vazir text-md text-right"
            htmlFor="confirmPassword"
          >
            تکرار رمز عبور
          </Label>
          <Input
            className="font-vazir mb-6 rounded-md border bg-inherit px-4 py-2"
            type="password"
            name="confirmPassword"
            placeholder="••••••••"
            required
          />
          <SubmitButton
            formAction={signUpWithEmail}
            className="font-vazir mb-2 rounded-md bg-blue-700 px-4 py-2 text-white"
          >
            ثبت نام
          </SubmitButton>
        </>
      )
    }
    if (searchParams.method === "phone") {
      return searchParams.step === "otp" ? (
        <>
          <input type="hidden" name="phone" value={searchParams.phone || ""} />
          <Label className="font-vazir text-md text-right" htmlFor="otp">
            کد تأیید
          </Label>
          <Input
            id="otp"
            name="otp"
            placeholder="123456"
            required
            className="font-vazir mb-3 rounded-md border bg-inherit px-4 py-2"
          />
          <SubmitButton
            formAction={verifyOtpForSignUp}
            className="font-vazir rounded-md bg-green-600 px-4 py-2 text-white"
          >
            تایید و ثبت نام
          </SubmitButton>
        </>
      ) : (
        <>
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
            formAction={sendOtpForSignUp}
            className="font-vazir rounded-md bg-blue-700 px-4 py-2 text-white"
          >
            ارسال کد
          </SubmitButton>
        </>
      )
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-1 px-8 sm:max-w-md">
      <form className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2">
        {/* جایگزین کردن Brand با انیمیشن */}
        <div className="mb-0 flex justify-center">
          <AnimationHero />
        </div>
        {renderContent()}
        <div className="font-vazir mt-2 text-center text-sm">
          حساب کاربری دارید؟{" "}
          <a
            href="/login"
            className="font-vazir font-bold underline hover:opacity-80"
          >
            وارد شوید
          </a>
        </div>

        {searchParams?.message && (
          <p className="bg-foreground/10 text-foreground mt-4 rounded-md p-4 text-center text-sm">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
