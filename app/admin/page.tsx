import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { AdminClientPage } from "./admin-client"
import { getAdminData } from "./actions"

export default async function AdminPage() {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user }
  } = await supabase.auth.getUser()
  const ADMIN_EMAILS = ["soheil2833@gmail.com", "admin@rhyno.ir"]

  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return redirect("/login")
  }

  // دریافت داده‌ها از سرور اکشن
  const initialData = await getAdminData()

  // پاس دادن داده‌ها به کلاینت
  return <AdminClientPage user={user} initialData={initialData} />
}
