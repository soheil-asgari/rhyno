"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { SubmitButton } from "@/components/ui/submit-button"
import { sendCustomOtpAction, verifyCustomOtpAction } from "./actions"

// ۱. پراپ‌های جدید formAction و submitText را با مقادیر پیش‌فرض اضافه می‌کنیم
export default function OtpStep({
  phone,
  formAction = verifyCustomOtpAction, // اکشن پیش‌فرض برای صفحه لاگین
  submitText = "تأیید و ورود" // متن پیش‌فرض برای صفحه لاگین
}: {
  phone: string
  formAction?: (formData: FormData) => void
  submitText?: string
}) {
  const [timeLeft, setTimeLeft] = useState(120) // ۲ دقیقه

  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <>
      <input type="hidden" name="phone" value={phone} />

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

      {/* ۲. از پراپ formAction برای دکمه اصلی استفاده می‌کنیم */}
      <SubmitButton
        formAction={formAction}
        className="font-vazir rounded-md bg-green-600 px-4 py-2 text-white"
      >
        {/* ۳. از پراپ submitText برای متن دکمه استفاده می‌کنیم */}
        {submitText}
      </SubmitButton>

      {/* شمارش معکوس */}
      {timeLeft > 0 ? (
        <p className="font-vazir text-muted-foreground mt-3 text-center text-sm">
          تا ارسال مجدد: {minutes}:{seconds.toString().padStart(2, "0")}
        </p>
      ) : (
        <SubmitButton
          formAction={sendCustomOtpAction}
          className="font-vazir mt-3 w-full rounded-md bg-blue-700 px-4 py-2 text-white"
        >
          ارسال دوباره کد
        </SubmitButton>
      )}
    </>
  )
}
