"use client"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export default function PhoneLoginBox() {
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"phone" | "otp">("phone")
  const [msg, setMsg] = useState("")

  const sendOtp = async () => {
    const res = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    })
    const data = await res.json()
    if (data.success) {
      setStep("otp")
      setMsg("کد ارسال شد ✅")
    } else {
      setMsg("خطا در ارسال کد ❌")
    }
  }

  const verifyOtp = async () => {
    const res = await fetch("/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp })
    })
    const data = await res.json()
    if (data.success) {
      setMsg("ورود موفق 🎉")
      window.location.href = `/${data.workspaceId}/chat`
    } else {
      setMsg("کد نادرست ❌")
    }
  }

  return (
    <div className="rounded border p-3">
      {step === "phone" ? (
        <>
          <Label>شماره موبایل</Label>
          <Input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="09xxxxxxxxx"
          />
          <button
            type="button"
            onClick={sendOtp}
            className="mt-2 w-full rounded bg-blue-600 p-2 text-white"
          >
            ارسال کد
          </button>
        </>
      ) : (
        <>
          <Label>کد تأیید</Label>
          <Input
            value={otp}
            onChange={e => setOtp(e.target.value)}
            placeholder="123456"
          />
          <button
            type="button"
            onClick={verifyOtp}
            className="mt-2 w-full rounded bg-green-600 p-2 text-white"
          >
            تأیید
          </button>
        </>
      )}
      {msg && <p className="mt-2 text-center">{msg}</p>}
    </div>
  )
}
