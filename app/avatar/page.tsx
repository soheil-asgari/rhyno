// مسیر: app/avatar/page.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function AvatarRedirector() {
  const router = useRouter()

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      // ۱. چک کردن وضعیت لاگین
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session) {
        // اگر لاگین نیست، برود به صفحه ورود
        return router.push("/login?next=/avatar")
      }

      // ۲. گرفتن ورک‌اسپیس کاربر (اولی یا دیفالت)
      const { data: homeWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("is_home", true) // اگر ورک‌اسپیس "خانه" دارید
        .single()

      let targetWorkspaceId = homeWorkspace?.id

      // اگر ورک‌اسپیس خانه پیدا نشد، اولین ورک‌اسپیس را بگیر
      if (!targetWorkspaceId) {
        const { data: workspaces } = await supabase
          .from("workspaces")
          .select("id")
          .eq("user_id", session.user.id)
          .limit(1)
          .single()

        targetWorkspaceId = workspaces?.id
      }

      // ۳. هدایت نهایی
      if (targetWorkspaceId) {
        router.replace(`/${targetWorkspaceId}/avatar`)
      } else {
        // اگر هیچ ورک‌اسپیسی ندارد
        router.push("/setup")
      }
    }

    checkUserAndRedirect()
  }, [router])

  // نمایش یک لودینگ ساده حین انتقال
  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <Loader2 className="size-10 animate-spin text-blue-500" />
    </div>
  )
}
