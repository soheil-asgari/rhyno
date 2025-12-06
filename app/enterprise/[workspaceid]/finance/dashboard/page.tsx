import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import UnspecifiedList, { UnspecifiedItem } from "./UnspecifiedList"
// ✅ ایمپورت توابع جداگانه برای معین و تفصیلی
import { getRahkaranSLs, getRahkaranDLs } from "@/app/actions/finance-actions"

export default async function ManagerDashboard({
  params
}: {
  params: { workspaceid: string }
}) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // ✅ 1. دریافت همزمان دو لیست جداگانه از راهکاران (معین و تفصیلی)
  const [slAccounts, dlAccounts] = await Promise.all([
    getRahkaranSLs(), // لیست معین‌ها
    getRahkaranDLs() // لیست تفصیلی‌ها
  ])

  // 2. دریافت اسناد نامشخص (کارتابل اولویت دار)
  const { data: unspecifiedItems } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("status", "unspecified")
    .order("created_at", { ascending: true })

  // 3. آمارها
  const { count: pendingCount } = await supabase
    .from("payment_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_docs")
    .eq("workspace_id", params.workspaceid)

  const { count: completedCount } = await supabase
    .from("payment_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .eq("workspace_id", params.workspaceid)

  // 4. لیست تاریخچه
  const { data: recent } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("workspace_id", params.workspaceid)
    .neq("status", "unspecified")
    .order("created_at", { ascending: false })
    .limit(5)

  // محاسبه عملکرد
  const total = (pendingCount || 0) + (completedCount || 0)
  const performance =
    total > 0 ? (((completedCount || 0) / total) * 100).toFixed(0) : 0

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">داشبورد مدیریت مالی</h1>
        {unspecifiedItems && unspecifiedItems.length > 0 && (
          <span className="animate-pulse rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-800">
            {unspecifiedItems.length} سند نیاز به تعیین تکلیف دارد
          </span>
        )}
      </div>

      {/* بخش کارتابل تعیین تکلیف */}
      <Card className="border-orange-200 shadow-md">
        <CardHeader className="bg-orange-50/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-orange-700">
            ⚠️ اسناد نامشخص (نیاز به اقدام مدیر)
          </CardTitle>
          <p className="text-sm text-gray-500">
            لطفاً برای اسناد زیر، سرفصل حسابداری و طرف حساب را مشخص کنید.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <UnspecifiedList
            items={(unspecifiedItems as unknown as UnspecifiedItem[]) || []}
            // ✅ ارسال دو لیست جداگانه به کامپوننت
            slAccounts={slAccounts}
            dlAccounts={dlAccounts}
            workspaceId={params.workspaceid}
          />
        </CardContent>
      </Card>

      {/* بخش آمارها */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              پرونده‌های باز
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-gray-600">
              {pendingCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              تکمیل شده
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">
              {completedCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              عملکرد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">
              ٪{performance}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* بخش تاریخچه */}
      <Card>
        <CardHeader>
          <CardTitle>تاریخچه واریزی‌های اخیر</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-3">تامین کننده</th>
                <th className="pb-3">مبلغ</th>
                <th className="pb-3">وضعیت</th>
                <th className="pb-3">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {recent?.map(item => (
                <tr key={item.id} className="h-12 border-b last:border-0">
                  <td>{item.supplier_name}</td>
                  <td>{Number(item.amount).toLocaleString()}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-1 text-xs 
                      ${item.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                    >
                      {item.status === "completed"
                        ? "تکمیل شده"
                        : "در انتظار مدرک"}
                    </span>
                  </td>
                  <td>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString("fa-IR")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
