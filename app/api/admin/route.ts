import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Database } from "../../../supabase/types"

const ADMIN_EMAIL = "soheil2833@gmail.com"

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient<Database["public"]>({ cookies })

  const { searchParams } = new URL(request.url)
  const ticketId = searchParams.get("ticketId")

  // ۱. گرفتن session کاربر
  const {
    data: { session }
  } = await supabase.auth.getSession()

  // ۲. بررسی دسترسی ادمین
  if (session?.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 })
  }

  // گرفتن پیام‌های یک تیکت خاص
  if (ticketId) {
    const { data: messages, error } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching messages:", error)
      return NextResponse.json(
        { message: "خطا در دریافت پیام‌ها" },
        { status: 500 }
      )
    }
    return NextResponse.json(messages)
  }

  // گرفتن همه تیکت‌ها و ایمیل کاربر از auth.users
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("*, auth_users:user_id (email)")

  if (error) {
    console.error("Error fetching tickets:", error)
    return NextResponse.json(
      { message: "خطا در دریافت تیکت‌ها" },
      { status: 500 }
    )
  }

  const formattedTickets =
    tickets?.map(ticket => ({
      ...ticket,
      user: { email: ticket.auth_users?.email || "کاربر نامشخص" } // اصلاح شده
    })) || []

  return NextResponse.json(formattedTickets)
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient<Database["public"]>({ cookies })

  const {
    data: { session }
  } = await supabase.auth.getSession()
  if (!session || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 })
  }

  const { ticketId, content } = await request.json()

  // insert با تایپ دقیق Insert جدول ticket_messages
  const { data: newMessage, error: messageError } = await supabase
    .from("ticket_messages" as any)
    .insert({
      ticket_id: ticketId,
      user_id: session.user.id,
      content: content,
      is_admin_reply: true
    })
    .select()
    .single()

  if (messageError) {
    console.error("Error inserting message:", messageError)
    return NextResponse.json({ message: "خطا در ثبت پیام" }, { status: 500 })
  }

  // آپدیت کردن تیکت اصلی
  const { error: updateError } = await supabase
    .from("tickets")
    .update({
      status: "in-progress",
      updated_at: new Date().toISOString()
    })
    .eq("id", ticketId)

  if (updateError) {
    console.error("Error updating ticket:", updateError)
    return NextResponse.json(
      { message: "خطا در بروزرسانی تیکت" },
      { status: 500 }
    )
  }

  return NextResponse.json(newMessage)
}
