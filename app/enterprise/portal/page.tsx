"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/browser-client"
import { FiLoader } from "react-icons/fi"

export default function EnterprisePortal() {
  const router = useRouter()

  useEffect(() => {
    const resolveWorkspace = async () => {
      // 1. دریافت کاربر
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/enterprise/login")
        return
      }

      // 2. دریافت ورک‌اسپیس
      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)

      if (!workspaces || workspaces.length === 0) {
        alert("هیچ فضای کاری سازمانی یافت نشد.")
        return
      }

      const targetWorkspaceId = workspaces[0].id

      // 3. *** بخش جدید: دریافت نقش کاربر ***
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single()

      const userRole = profile?.role || "user"

      // 4. هدایت هوشمند بر اساس نقش
      if (userRole === "ceo") {
        // مدیر عامل -> داشبورد مدیریتی
        router.push(`/enterprise/${targetWorkspaceId}/ceo/dashboard`)
      } else if (
        ["finance_manager", "finance_staff", "payer"].includes(userRole)
      ) {
        // تیم مالی -> داشبورد مالی
        router.push(`/enterprise/${targetWorkspaceId}/finance/dashboard`)
      } else {
        // سایر کاربران (ادمین یا عادی) -> داشبورد اصلی (BI)
        router.push(`/enterprise/${targetWorkspaceId}/dashboard`)
      }
    }

    resolveWorkspace()
  }, [router])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 dark:bg-[#0f1018]">
      <FiLoader className="size-12 animate-spin text-blue-600" />
      <p className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-300">
        در حال شناسایی نقش و ورود به سامانه...
      </p>
    </div>
  )
}
