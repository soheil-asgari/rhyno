import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers" // ایمپورت ضروری
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UploadDocsForm } from "./upload-docs-form"

export default async function CartablePage({
  params
}: {
  params: { workspaceid: string }
}) {
  // اصلاح ۱: دریافت کوکی استور و پاس دادن به createClient
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: requests } = await supabase
    .from("payment_requests")
    .select("*")
    .eq("workspace_id", params.workspaceid)
    .eq("status", "pending_docs")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6 p-8">
      <h1 className="text-3xl font-bold">کارتابل پیگیری اسناد</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {requests?.map(req => (
          <Card
            key={req.id}
            className="border-l-4 border-l-orange-500 shadow-md"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between text-lg">
                <span>{req.supplier_name}</span>
                {/* اصلاح ۲: چک کردن نال نبودن تاریخ */}
                <span className="text-sm font-normal text-gray-500">
                  {req.created_at
                    ? new Date(req.created_at).toLocaleDateString("fa-IR")
                    : "-"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 space-y-1 text-sm text-gray-600">
                <p>مبلغ: {Number(req.amount).toLocaleString()} ریال</p>
                <p>کد پیگیری: {req.tracking_code}</p>
                <p className="text-xs">سند راهکاران: {req.rahkaran_id}</p>
              </div>

              <UploadDocsForm requestId={req.id} workspaceId={""} />
            </CardContent>
          </Card>
        ))}

        {(!requests || requests.length === 0) && (
          <p className="col-span-full mt-10 text-center text-gray-500">
            هیچ کار باقی‌مانده‌ای وجود ندارد! 🎉
          </p>
        )}
      </div>
    </div>
  )
}
