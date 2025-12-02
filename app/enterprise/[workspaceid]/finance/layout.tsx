import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { LogOut, ArrowRight } from "lucide-react"
import Link from "next/link"
import { FinanceSidebar } from "@/components/finance/finance-sidebar"

export default async function FinanceLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { workspaceid: string }
}) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user }
  } = await supabase.auth.getUser()
  let userRole = "finance_staff" // مقدار اولیه

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()

    // اصلاح: مدیریت مقدار null با عملگر ||
    if (profile?.role) {
      userRole = profile.role
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-gray-50 font-sans text-gray-900"
      dir="rtl"
    >
      <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="flex items-center gap-2 text-xl font-bold text-blue-800">
            <span className="rounded-lg bg-blue-100 p-2 text-xl">💰</span>
            سامانه مدیریت مالی راینو
          </h1>
          <span className="rounded-full border bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            نسخه سازمانی
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/enterprise/${params.workspaceid}/dashboard`}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-500 hover:text-blue-600"
            >
              <ArrowRight className="size-4" /> بازگشت به داشبورد اصلی
            </Button>
          </Link>
          <Link href="/enterprise/login">
            <Button variant="destructive" size="sm" className="gap-2">
              <LogOut className="size-4" /> خروج
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* اکنون userRole قطعاً رشته است */}
        <FinanceSidebar workspaceId={params.workspaceid} userRole={userRole} />

        <main className="flex-1 overflow-y-auto bg-gray-50/50 p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      <Toaster />
    </div>
  )
}
