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

  // 1. Get data from server action
  const initialData = await getAdminData()

  // 2. Sanitize the data to handle undefined values
  // If initialData might be an error object, we should handle that too,
  // but this specific fix solves the "undefined is not assignable to any[]" error.
  const sanitizedData = {
    ...initialData,
    // Use nullish coalescing (??) to default to empty array if undefined
    tickets:
      "tickets" in initialData && initialData.tickets
        ? initialData.tickets
        : [],
    users: "users" in initialData && initialData.users ? initialData.users : []
  }

  // 3. Pass the sanitized data
  return <AdminClientPage user={user} initialData={sanitizedData} />
}
