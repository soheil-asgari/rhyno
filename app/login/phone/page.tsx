import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { redirect } from "next/navigation"

export const metadata = {
  title: "ورود با شماره موبایل"
}

export default async function PhoneLoginPage({
  searchParams
}: {
  searchParams: { step: string; phone: string; message: string }
}) {
  // ... (بخش Server Actions بدون تغییر باقی می‌ماند)
  const step = searchParams.step || "phone"

  const sendOtp = async (formData: FormData) => {
    "use server"
    const phone = formData.get("phone") as string
    const isSuccess = true
    if (isSuccess) {
      const message = "کد برای شما ارسال شد ✅"
      redirect(
        `/login/phone?step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}`
      )
    } else {
      const message = "خطا در ارسال کد ❌"
      redirect(`/login/phone?message=${encodeURIComponent(message)}`)
    }
  }

  const verifyOtp = async (formData: FormData) => {
    "use server"
    const phone = formData.get("phone") as string
    const otp = formData.get("otp") as string
    const data = { success: true, workspaceId: "workspace-123" }
    if (data.success) {
      redirect(`/${data.workspaceId}/chat`)
    } else {
      const message = "کد واردشده نادرست است ❌"
      redirect(
        `/login/phone?step=otp&phone=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}`
      )
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form
        className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2"
        action={step === "phone" ? sendOtp : verifyOtp}
      >
        <Brand />

        <h1 className="mt-4 text-center text-2xl font-bold text-white"></h1>
        {/* 🚨 تغییر ۱: فاصله پایینی بیشتر شد تا متن پایین‌تر بیاید */}
        <p className="mb-10 text-center text-sm text-gray-400">
          ورود با شماره موبایل
        </p>

        {step === "phone" ? (
          <>
            {/* 🚨 تغییر ۲: کلاس text-right برای راست‌چین کردن لیبل اضافه شد */}
            <Label htmlFor="phone" className="text-md mt-4 text-right">
              شماره موبایل
            </Label>
            <Input
              id="phone"
              name="phone"
              placeholder="09xxxxxxxxx"
              required
              className="mb-3 rounded-md border bg-inherit px-4 py-2"
            />
            <SubmitButton className="mb-2 rounded-md bg-blue-700 px-4 py-2 text-white">
              ارسال کد
            </SubmitButton>
            {/* جداکننده */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background text-muted-foreground px-2">
                  یا
                </span>
              </div>
            </div>
            <div className="flex justify-center">
              <a
                href="/login"
                className="w-full rounded-md bg-green-600 px-4 py-2 text-center text-white hover:opacity-90"
              >
                ورود با ایمیل و رمز عبور
              </a>
            </div>
          </>
        ) : (
          <>
            <input
              type="hidden"
              name="phone"
              value={searchParams.phone || ""}
            />
            {/* 🚨 تغییر ۲ (برای مرحله دوم نیز اعمال شد) */}
            <Label htmlFor="otp" className="text-md mt-4 text-right">
              کد تأیید
            </Label>
            <Input
              id="otp"
              name="otp"
              placeholder="123456"
              required
              className="mb-3 rounded-md border bg-inherit px-4 py-2"
            />
            <SubmitButton className="mb-2 rounded-md bg-green-600 px-4 py-2 text-white">
              تأیید
            </SubmitButton>
          </>
        )}

        {searchParams?.message && (
          <p
            className={`bg-foreground/10 text-foreground mt-4 rounded-md p-4 text-center ${searchParams.message.includes("❌") ? "text-red-500" : "text-green-500"}`}
          >
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
