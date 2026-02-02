import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UploadDocsForm } from "./upload-docs-form"
import { RequestNotes } from "@/components/finance/request-notes" // اطمینان از ایمپورت

export default async function CartablePage({
  params
}: {
  params: { workspaceid: string }
}) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // ۱. دریافت کاربر جاری
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return <div>لطفا وارد شوید</div>

  // ۲. کوئری دریافت درخواست‌ها همراه با نوت‌ها
  const { data: requests } = await supabase
    .from("payment_requests")
    .select(
      `
      *,
      request_notes (
        id,
        content,
        created_at,
        user_id,
        profiles:user_id ( display_name ) 
      )
    `
    )
    .eq("workspace_id", params.workspaceid)
    .eq("assigned_user_id", user.id)
    .eq("status", "pending_docs")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">کارتابل پیگیری من</h1>
        <span className="text-sm text-gray-500">کاربر: {user.email}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {requests?.map(req => {
          // محاسبه زمان باقی‌مانده (ددلاین)
          const deadline = req.deadline ? new Date(req.deadline) : null
          let deadlineText = "بدون مهلت تعیین شده"
          let isOverdue = false
          let diffHours = 0

          if (deadline) {
            const now = new Date()
            diffHours = Math.floor(
              (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
            )
            isOverdue = diffHours < 0
            deadlineText = isOverdue
              ? `⚠️ مهلت تمام شده! (${Math.abs(diffHours)} ساعت تاخیر)`
              : `⏳ مهلت باقی‌مانده: ${diffHours} ساعت`
          }

          return (
            <Card
              key={req.id}
              className={`border-l-4 shadow-md ${req.ai_verification_status === "rejected" ? "border-l-red-500" : "border-l-orange-500"}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span>{req.supplier_name}</span>
                  {req.customer_group && (
                    <Badge variant="outline" className="text-xs">
                      {req.customer_group}
                    </Badge>
                  )}
                </CardTitle>
                <span className="text-xs text-gray-400">
                  {req.created_at
                    ? new Date(req.created_at).toLocaleDateString("fa-IR")
                    : "-"}
                </span>
              </CardHeader>
              <CardContent>
                {/* بخش نمایش ددلاین */}
                <div
                  className={`mb-3 rounded border p-2 text-center text-xs font-bold ${isOverdue ? "border-red-100 bg-red-50 text-red-600" : "border-blue-100 bg-blue-50 text-blue-600"}`}
                >
                  {deadlineText}
                </div>

                <div className="mb-4 space-y-2 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                  <p className="flex justify-between">
                    <span>مبلغ:</span>{" "}
                    <span className="font-bold">
                      {Number(req.amount).toLocaleString()} ریال
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span>کد پیگیری:</span> <span>{req.tracking_code}</span>
                  </p>
                  <p className="text-xs text-gray-500">{req.description}</p>

                  {/* نمایش خطای هوش مصنوعی اگر وجود دارد */}
                  {req.ai_verification_status === "rejected" && (
                    <div className="mt-2 rounded border border-red-100 bg-red-50 p-2 text-xs text-red-600">
                      🤖 <b>رد شده توسط هوش مصنوعی:</b>
                      <br />
                      {req.ai_verification_reason}
                    </div>
                  )}
                </div>

                <UploadDocsForm
                  requestId={req.id}
                  workspaceId={params.workspaceid}
                  currentAiStatus={req.ai_verification_status || undefined}
                />

                {/* کامپوننت یادداشت‌ها */}
                <RequestNotes
                  requestId={req.id}
                  notes={req.request_notes || []}
                />
              </CardContent>
            </Card>
          )
        })}

        {(!requests || requests.length === 0) && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
            <p className="text-lg">سینی کارتابل شما خالی است! ✨</p>
            <p className="text-sm">
              هیچ مورد پیگیری برای شما اختصاص داده نشده است.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
