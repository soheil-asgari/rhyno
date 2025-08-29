"use client"

import { useSearchParams } from "next/navigation"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { SubmitButton } from "@/components/ui/submit-button"
import {
  sendCustomOtpAction,
  verifyAndUpdatePhoneAction
} from "@/app/login/actions"
import OtpStep from "@/app/login/OtpStep"

export default function VerifyPhonePage() {
  const searchParams = useSearchParams()
  const step = searchParams.get("step")
  const phone = searchParams.get("phone")
  const message = searchParams.get("message")

  return (
    <div className=" font-vazir flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form className="font-vazir animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2">
        <h1 className="font-vazir mb-4 text-center text-2xl font-bold">
          تکمیل پروفایل
        </h1>
        <p className="font-vazir text-muted-foreground mb-6 text-center text-sm">
          برای استفاده از تمام امکانات سایت، لطفاً شماره تلفن خود را تأیید کنید.
        </p>

        {step === "otp" && phone ? (
          // اگر در مرحله OTP بودیم، کامپوننت OTP را نمایش بده
          // توجه: اکشن آن، اکشن جدید ما یعنی verifyAndUpdatePhoneAction است
          <OtpStep phone={phone} formAction={verifyAndUpdatePhoneAction} />
        ) : (
          // در غیر این صورت، فرم ورود شماره تلفن را نمایش بده
          <>
            <input type="hidden" name="referer" value="/verify-phone" />
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
              ارسال کد تأیید
            </SubmitButton>
          </>
        )}
        {message && (
          <p className="font-vazir bg-foreground/10 text-foreground mt-4 rounded-md p-4 text-center text-sm">
            {message}
          </p>
        )}
      </form>
    </div>
  )
}
