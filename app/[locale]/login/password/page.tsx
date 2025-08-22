"use client"

import { ChangePassword } from "@/components/utility/change-password"
import { supabase } from "@/lib/supabase/browser-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function ChangePasswordPage() {
  const [loading, setLoading] = useState(true)
  const [sessionChecked, setSessionChecked] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let isMounted = true // جلوگیری از setState بعد از unmount

    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const session = data.session

        if (isMounted) {
          if (!session) {
            // فقط یکبار redirect بزن
            router.replace("/login") // replace به جای push برای جلوگیری از history loop
          } else {
            setLoading(false)
          }
          setSessionChecked(true)
        }
      } catch (err) {
        console.error("Error checking session:", err)
        if (isMounted) {
          router.replace("/login")
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [router])

  // تا وقتی session چک نشده، چیزی نمایش نده
  if (loading && !sessionChecked) {
    return null
  }

  return <ChangePassword />
}
