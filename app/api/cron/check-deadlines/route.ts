import { createClient } from "@supabase/supabase-js"
import { sendReminderSMS } from "@/lib/sms-service"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const now = new Date().toISOString()

    const { data: overdueRequests, error } = await supabaseAdmin
      .from("payment_requests")
      .select(
        `
        id, 
        supplier_name, 
        deadline,
        assigned_user_id,
        profiles:assigned_user_id ( phone )
      `
      )
      .lt("deadline", now)
      .eq("status", "pending_docs")
      .is("last_reminder_sent_at", null)

    if (error) throw error

    let sentCount = 0

    for (const item of overdueRequests || []) {
      // @ts-ignore: مدیریت آرایه/آبجکت پروفایل
      const phone = item.profiles?.phone || item.profiles?.[0]?.phone

      // رفع ارور null: اگر نام تامین‌کننده نبود، متن جایگزین بگذار
      const supplierName = item.supplier_name || "پرونده مالی"

      if (phone) {
        await sendReminderSMS(phone, supplierName)

        await supabaseAdmin
          .from("payment_requests")
          .update({ last_reminder_sent_at: new Date().toISOString() })
          .eq("id", item.id)

        sentCount++
      }
    }

    return NextResponse.json({
      success: true,
      processed: overdueRequests?.length || 0,
      sent_sms: sentCount
    })
  } catch (error: any) {
    console.error("Cron Job Error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
