import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import UnspecifiedList, { UnspecifiedItem } from "./UnspecifiedList"
// ✅ ایمپورت توابع جداگانه برای دریافت حساب‌های معین و تفصیلی
import { getRahkaranSLs, getRahkaranDLs } from "@/app/actions/finance-actions"

export default async function ManagerDashboard({
  params
}: {
  params: { workspaceid: string }
}) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // ✅ 1. دریافت همزمان لیست معین‌ها و تفصیلی‌ها از راهکاران (Server-Side)
  const [slAccounts, dlAccounts] = await Promise.all([
    getRahkaranSLs(),
    getRahkaranDLs()
  ])

  // 2. دریافت اسناد نامشخص (کارتابل اولویت دار)
  const { data: unspecifiedItems } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("status", "unspecified")
    .eq("workspace_id", params.workspaceid) // اضافه کردن فیلتر ورک‌اسپیس برای امنیت
    .order("created_at", { ascending: true })

  // 3. آمارها (تعداد پرونده‌های باز)
  const { count: pendingCount } = await supabase
    .from("payment_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_docs")
    .eq("workspace_id", params.workspaceid)

  // آمارها (تعداد تکمیل شده)
  const { count: completedCount } = await supabase
    .from("payment_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .eq("workspace_id", params.workspaceid)

  // 4. لیست تاریخچه (۵ تراکنش آخر)
  const { data: recent } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("workspace_id", params.workspaceid)
    .neq("status", "unspecified")
    .order("created_at", { ascending: false })
    .limit(5)

  // محاسبه درصد عملکرد
  const total = (pendingCount || 0) + (completedCount || 0)
  const performance =
    total > 0 ? (((completedCount || 0) / total) * 100).toFixed(0) : 0

  return (
    <div className="min-h-screen space-y-8 bg-gray-50 p-8 text-gray-900">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">داشبورد مدیریت مالی</h1>
        {unspecifiedItems && unspecifiedItems.length > 0 && (
          <span className="animate-pulse rounded-full border border-red-200 bg-red-100 px-3 py-1 text-sm font-bold text-red-800">
            {unspecifiedItems.length} سند نیاز به تعیین تکلیف دارد
          </span>
        )}
      </div>

      {/* بخش کارتابل تعیین تکلیف */}
      <Card className="border-orange-200 bg-white shadow-md">
        <CardHeader className="border-b border-orange-100 bg-orange-50 pb-4">
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
            slAccounts={slAccounts} // ✅ ارسال لیست معین
            dlAccounts={dlAccounts} // ✅ ارسال لیست تفصیلی
            workspaceId={params.workspaceid}
          />
        </CardContent>
      </Card>

      {/* بخش آمارها */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              پرونده‌های باز
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-gray-700">
              {pendingCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
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
        <Card className="bg-white">
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
      <Card className="bg-white text-gray-900">
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
                <tr
                  key={item.id}
                  className="h-12 border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="font-medium text-gray-900">
                    {item.supplier_name}
                  </td>
                  <td className="text-gray-700">
                    {Number(item.amount).toLocaleString()}
                  </td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium
                      ${
                        item.status === "completed"
                          ? "border border-green-200 bg-green-100 text-green-700"
                          : "border border-gray-200 bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.status === "completed"
                        ? "تکمیل شده"
                        : "در انتظار مدرک"}
                    </span>
                  </td>
                  <td className="text-gray-500">
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
