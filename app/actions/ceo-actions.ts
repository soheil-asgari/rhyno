"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export async function getCeoFinancialStats(
  workspaceId: string,
  timeRange: string = "30_days"
) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // ۱. دریافت داده‌های مالی
  let query = supabase
    .from("payment_requests")
    .select("amount, status, assigned_user_id, created_at")
    .eq("workspace_id", workspaceId)

  if (timeRange !== "all") {
    const date = new Date()
    if (timeRange === "30_days") date.setDate(date.getDate() - 30)
    if (timeRange === "7_days") date.setDate(date.getDate() - 7)
    query = query.gte("created_at", date.toISOString())
  }

  const { data: requests, error } = await query

  if (error) {
    console.error("CEO Stats Error:", error)
    return { success: false, error: error.message }
  }

  // ۲. استخراج لیست کاربران منحصر‌به‌فرد
  const userIds = Array.from(
    new Set(
      requests.map((r: any) => r.assigned_user_id).filter((id: any) => id)
    )
  ) as string[]

  // ۳. دریافت اطلاعات پروفایل‌ها (اصلاح شده: حذف email)
  let profilesMap: Record<string, any> = {}

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name") // <--- فقط فیلدهای موجود در جدول پروفایل
      .in("user_id", userIds)

    if (profiles) {
      profiles.forEach(p => {
        profilesMap[p.user_id] = p
      })
    }
  }

  // ۴. محاسبات آماری
  const totalCount = requests.length
  const totalAmount = requests.reduce(
    (sum, r) => sum + (Number(r.amount) || 0),
    0
  )

  const officerMap = new Map<
    string,
    {
      name: string
      total: number
      completed: number
      open: number
    }
  >()

  requests.forEach((r: any) => {
    const officerId = r.assigned_user_id || "unassigned"

    let officerName = "تخصیص نیافته"
    if (officerId !== "unassigned") {
      const profile = profilesMap[officerId]
      // چون ایمیل نداریم، اگر نام نبود از ID خلاصه استفاده می‌کنیم
      officerName =
        profile?.display_name || `کاربر ${officerId.substring(0, 4)}...`
    }

    if (!officerMap.has(officerId)) {
      officerMap.set(officerId, {
        name: officerName,
        total: 0,
        completed: 0,
        open: 0
      })
    }

    const stats = officerMap.get(officerId)!
    stats.total += 1

    if (r.status === "completed" || r.status === "settled") {
      stats.completed += 1
    } else {
      stats.open += 1
    }
  })

  // ۵. خروجی نهایی
  const officerStats = Array.from(officerMap.values()).map(s => ({
    ...s,
    completionRate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
    remainingRate:
      s.total > 0 ? 100 - Math.round((s.completed / s.total) * 100) : 0
  }))

  return {
    success: true,
    data: {
      overview: { count: totalCount, amount: totalAmount },
      officers: officerStats
    }
  }
}
