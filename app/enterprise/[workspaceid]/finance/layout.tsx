import { Toaster } from "@/components/ui/sonner" // یا هر Toaster که دارید
import { Button } from "@/components/ui/button"
import { FiLogOut, FiArrowRight } from "react-icons/fi"
import Link from "next/link"

export default function FinanceLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { workspaceid: string }
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-auto bg-gray-50 font-sans text-gray-900"
      dir="rtl"
    >
      {/* هدر اختصاصی مالی */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="flex items-center gap-2 text-xl font-bold text-blue-800">
            <span className="rounded-lg bg-blue-100 p-2">💰</span>
            سامانه مدیریت مالی راینو
          </h1>
          <span className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-600">
            نسخه سازمانی
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* دکمه بازگشت به داشبورد اصلی (اختیاری) */}
          <Link href={`/enterprise/${params.workspaceid}/dashboard`}>
            <Button variant="ghost" size="sm" className="text-gray-500">
              {/* <FiArrowRight className="ml-2" /> بازگشت به BI */}
            </Button>
          </Link>

          <Link href="/enterprise/login">
            <Button variant="destructive" size="sm">
              <FiLogOut className="ml-2" /> خروج
            </Button>
          </Link>
        </div>
      </header>

      {/* محتوای اصلی (همان کارتابل شما اینجا نمایش داده می‌شود) */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-6">{children}</main>

      <Toaster />
    </div>
  )
}
