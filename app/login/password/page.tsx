// app/login/password/page.tsx

"use client"

import { ChangePassword } from "@/components/utility/change-password"
import { supabase } from "@/lib/supabase/browser-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export default function ChangePasswordPage() {
  const [isSessionReady, setIsSessionReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // onAuthStateChange روش پیشنهادی برای مدیریت رویدادهای احراز هویت است
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // این رویداد زمانی فعال می‌شود که کاربر پس از کلیک روی لینک بازیابی رمز عبور،
        // وارد این صفحه می‌شود و Supabase یک session موقت برای او ایجاد می‌کند.
        if (event === "PASSWORD_RECOVERY") {
          setIsSessionReady(true)
        } else if (!session) {
          // اگر session وجود نداشته باشد و رویداد هم از نوع بازیابی رمز نباشد،
          // کاربر را به صفحه لاگین هدایت می‌کنیم.
          toast.error("لینک نامعتبر یا منقضی شده است. لطفاً دوباره تلاش کنید.")
          router.push("/login")
        }
      }
    )

    // این بخش برای زمانی است که کاربر صفحه را رفرش می‌کند.
    // در این حالت ممکن است رویداد PASSWORD_RECOVERY دیگر فراخوانی نشود،
    // اما session همچنان معتبر است.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsSessionReady(true)
      }
    })

    // در زمان unmount شدن کامپوننت، listener را پاک می‌کنیم
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  // تا زمانی که session آماده نشده، یک پیام لودینگ نمایش می‌دهیم
  if (!isSessionReady) {
    return (
      <p className="flex h-screen items-center justify-center">
        در حال اعتبارسنجی لینک...
      </p>
    )
  }

  // پس از تایید session، فرم را نمایش می‌دهیم
  return <ChangePassword />
}
