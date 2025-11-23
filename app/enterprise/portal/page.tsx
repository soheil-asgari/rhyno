// app/(enterprise)/portal/page.tsx
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/browser-client"
import { getWorkspacesByUserId } from "@/db/workspaces" // این تابع را باید ایمپورت کنیم (شاید نیاز به ساخت اکشن سروری باشد)
import { FiLoader } from "react-icons/fi"

export default function EnterprisePortal() {
  const router = useRouter()

  useEffect(() => {
    const resolveWorkspace = async () => {
      // 1. گرفتن کاربر فعلی
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/enterprise/login")
        return
      }

      // 2. دریافت ورک‌اسپیس‌های این کاربر
      // نکته: چون getWorkspacesByUserId سمت سرور است، بهتر است اینجا یک API Route صدا بزنیم
      // یا از کلاینت ساپربیس استفاده کنیم:

      const { data: workspaces, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }) // جدیدترین ورک‌اسپیس
        .limit(1)

      if (error || !workspaces || workspaces.length === 0) {
        // اگر ورک‌اسپیسی نداشت، شاید باید بسازیم یا ارور بدهیم
        // برای نسخه سازمانی فرض بر این است که شما قبلا ورک‌اسپیس را ساخته‌اید
        alert("هیچ فضای کاری سازمانی یافت نشد.")
        return
      }

      const targetWorkspaceId = workspaces[0].id

      // 3. هدایت به داشبورد اصلی با شناسه صحیح
      router.push(`/enterprise/${targetWorkspaceId}/dashboard`)
    }

    resolveWorkspace()
  }, [router])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 dark:bg-[#0f1018]">
      <FiLoader className="size-12 animate-spin text-blue-600" />
      <p className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-300">
        در حال بارگذاری محیط سازمانی...
      </p>
    </div>
  )
}
