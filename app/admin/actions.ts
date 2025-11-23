// app/admin/actions.ts
"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// دریافت تمام داده‌ها
export async function getAdminData() {
  try {
    const {
      data: { users },
      error: userError
    } = await supabaseAdmin.auth.admin.listUsers()
    if (userError) throw userError

    const { data: profiles } = await supabaseAdmin.from("profiles").select("*")
    const { data: wallets } = await supabaseAdmin.from("wallets").select("*")
    const { data: tickets } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })

    const fullUsers = users.map(user => {
      const profile = profiles?.find(p => p.user_id === user.id)
      const wallet = wallets?.find(w => w.user_id === user.id)
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        display_name: profile?.display_name || "کاربر",
        balance: wallet ? wallet.balance : 0
      }
    })

    const enrichedTickets = tickets?.map(ticket => {
      const user = fullUsers.find(u => u.id === ticket.user_id)
      return {
        ...ticket,
        user: { email: user?.email || "Unknown" }
      }
    })

    return { users: fullUsers, tickets: enrichedTickets }
  } catch (error: any) {
    console.error("Admin Data Error:", error)
    return { users: [], tickets: [], error: error.message }
  }
}

// پاسخ به تیکت
export async function replyToTicketAction(
  ticketId: string,
  content: string,
  adminId: string
) {
  const { error } = await supabaseAdmin.from("ticket_messages").insert({
    ticket_id: ticketId,
    user_id: adminId,
    content,
    is_admin_reply: true
  })
  if (error) return { error: error.message }

  await supabaseAdmin
    .from("tickets")
    .update({
      status: "in-progress",
      updated_at: new Date().toISOString()
    })
    .eq("id", ticketId)

  revalidatePath("/admin")
  return { success: true }
}

// بستن تیکت
export async function closeTicketAction(ticketId: string) {
  await supabaseAdmin
    .from("tickets")
    .update({
      status: "closed",
      updated_at: new Date().toISOString()
    })
    .eq("id", ticketId)
  revalidatePath("/admin")
  return { success: true }
}

// ساخت اکانت سازمانی (اصلاح شده با upsert)
export async function createEnterpriseAccount(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const companyName = formData.get("company") as string
  const balance = parseInt(formData.get("balance") as string) || 0

  if (!email || !password || !companyName) return { error: "اطلاعات ناقص است" }

  // ۱. ساخت یوزر
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { is_enterprise: true, company: companyName }
    })

  if (authError) return { error: authError.message }
  const userId = authData.user.id

  // ۲. آپدیت یا ساخت پروفایل (اینجا از upsert استفاده می‌کنیم)
  // ✅ اصلاح مهم: استفاده از upsert به جای insert برای جلوگیری از تداخل با Trigger
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      user_id: userId,
      username:
        companyName.toLowerCase().replace(/\s/g, "_") +
        "_" +
        Math.floor(Math.random() * 1000),
      display_name: companyName,
      has_onboarded: true, // این خط باعث می‌شود کاربر به صفحه Setup نرود
      image_url: "",
      image_path: "",
      bio: "Enterprise Account",
      profile_context: "Enterprise Customer"
    },
    { onConflict: "user_id" }
  )

  if (profileError) {
    console.error("Profile creation failed:", profileError)
    // حتی اگر پروفایل فیل شد، ادامه می‌دهیم چون یوزر ساخته شده
  }

  // ۳. ساخت ورک‌اسپیس
  await supabaseAdmin.from("workspaces").insert({
    user_id: userId,
    name: companyName,
    is_home: true,
    default_context_length: 4096,
    default_model: "gpt-4-turbo",
    default_prompt: "You are a helpful AI assistant.",
    default_temperature: 0.5,
    description: "Enterprise Workspace",
    embeddings_provider: "openai",
    include_profile_context: true,
    include_workspace_instructions: true,
    instructions: ""
  })

  // ۴. شارژ کیف پول
  if (balance > 0) {
    await supabaseAdmin.from("wallets").insert({
      user_id: userId,
      balance: balance
    })
  }

  revalidatePath("/admin")
  return { success: true }
}

// حذف کاربر
export async function deleteUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  revalidatePath("/admin")
  return { success: true }
}
