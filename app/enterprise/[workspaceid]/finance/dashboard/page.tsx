import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers" // ایمپورت ضروری
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function ManagerDashboard({
  params
}: {
  params: { workspaceid: string }
}) {
  // اصلاح مهم: پاس دادن کوکی
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // دریافت آمار
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

  // دریافت لیست اخیر
  const { data: recent } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("workspace_id", params.workspaceid)
    .order("created_at", { ascending: false })
    .limit(5)

  // محاسبه درصد
  const total = (pendingCount || 0) + (completedCount || 0)
  const performance =
    total > 0 ? (((completedCount || 0) / total) * 100).toFixed(0) : 0

  return (
    <div className="space-y-8 p-8">
      <h1 className="text-3xl font-bold">داشبورد مدیریت مالی</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              پرونده‌های باز
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-600">
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
              عملکرد کلی
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">
              ٪{performance}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>آخرین واریزی‌ها</CardTitle>
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
                      className={`rounded-full px-2 py-1 text-xs ${item.status === "completed" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                    >
                      {item.status === "completed"
                        ? "تکمیل شده"
                        : "در انتظار مدرک"}
                    </span>
                  </td>
                  {/* اصلاح تاریخ */}
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
