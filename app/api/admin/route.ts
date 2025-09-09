// app/api/admin/route.ts (کد نهایی و کامل)

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Database } from "../../../supabase/types"

// app/api/admin/route.ts -> لطفاً فقط تابع GET را با این کد نهایی جایگزین کنید
const ADMIN_EMAIL = "soheil2833@gmail.com"

type TicketFromRPC = {
  id: string
  user_id: string
  subject: string | null
  status: string | null
  created_at: string
  updated_at: string
  user_email: string | null
}

export async function GET(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name, options) {
          cookieStore.set({ name, value: "", ...options })
        }
      }
    }
  )

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 })
  }

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name, options) {
          cookieStore.set({ name, value: "", ...options })
        }
      },
      auth: { persistSession: false }
    }
  )

  const { searchParams } = new URL(request.url)
  const ticketId = searchParams.get("ticketId")

  if (ticketId) {
    const { data: messages, error } = await supabaseAdmin
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

  const { data: tickets, error } = await supabaseAdmin.rpc(
    "get_all_tickets_with_user_email"
  )

  if (error) {
    console.error("Error calling RPC 'get_all_tickets_with_user_email':", error)
    return NextResponse.json(
      { message: "خطا در دریافت تیکت‌ها از تابع RPC" },
      { status: 500 }
    )
  }

  // --- تغییر نهایی اینجاست ---
  // ما به پارامتر 'ticket' به صورت دستی Type می‌دهیم تا خطا برطرف شود
  const formattedTickets =
    tickets?.map((ticket: TicketFromRPC) => ({
      ...ticket,
      user: { email: ticket.user_email || "کاربر نامشخص" }
    })) || []

  return NextResponse.json(formattedTickets)
}

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options })
        }
      }
    }
  )

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 })
  }

  const { ticketId, content } = await request.json()

  const { data: newMessage, error: messageError } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      user_id: user.id,
      content: content,
      is_admin_reply: true
    })
    .select()
    .single()

  if (messageError) {
    console.error("Error inserting message:", messageError)
    return NextResponse.json({ message: "خطا در ثبت پیام" }, { status: 500 })
  }

  // ... بقیه کد POST handler بدون تغییر ...
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
