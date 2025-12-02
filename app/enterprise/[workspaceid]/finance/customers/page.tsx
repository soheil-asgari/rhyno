import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { GroupSettings } from "@/components/finance/group-settings"
import { Separator } from "@/components/ui/separator"

export default async function FinanceCustomersPage({
  params
}: {
  params: { workspaceid: string }
}) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  // دریافت لیست کاربران برای دراپ‌داون انتخاب مسئول
  const { data: workspaceUsers } = await supabase
    .from("profiles")
    .select("id, email, full_name")

  return (
    <div className="flex min-h-screen flex-col space-y-6 bg-gray-50/30 p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            مدیریت مشتریان و مسئولین
          </h2>
          <p className="text-sm text-gray-500">
            محل بارگذاری فایل اکسل مشتریان و تعیین مسئول پیگیری برای هر گروه
          </p>
        </div>
      </div>
      <Separator className="my-4" />

      {/* کامپوننت مدیریت (آپلود + تخصیص) */}
      <GroupSettings
        workspaceId={params.workspaceid}
        workspaceUsers={workspaceUsers || []}
      />
    </div>
  )
}
