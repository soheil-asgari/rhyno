// app/(enterprise)/[workspaceid]/layout.tsx
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { EnterpriseSidebar } from "@/components/bi/EnterpriseSidebar"

export default async function EnterpriseWorkspaceLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { workspaceid: string }
}) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) {
    return redirect("/login")
  }

  // در اینجا می‌توانید چک کنید که آیا این ورک‌اسپیس اکانت Enterprise دارد یا خیر
  // const hasAccess = await checkEnterpriseAccess(params.workspaceid)
  // if (!hasAccess) redirect('/upgrade')

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* سایدبار ثابت سمت راست */}
      <EnterpriseSidebar workspaceId={params.workspaceid} />

      {/* محتوای اصلی */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-[#0f1018]">
        {children}
      </main>
    </div>
  )
}
