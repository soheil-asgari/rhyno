import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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
          return undefined
        },
        set(name: string, value: string, options: CookieOptions) {
          // Do nothing
        },
        remove(name: string, options: CookieOptions) {
          // Do nothing
        }
      }
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
    console.error("Error calling RPC:", error)
    return NextResponse.json(
      { message: "خطا در دریافت تیکت‌ها از تابع RPC" },
      { status: 500 }
    )
  }

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

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return undefined
        },
        set(name: string, value: string, options: CookieOptions) {
          // Do nothing
        },
        remove(name: string, options: CookieOptions) {
          // Do nothing
        }
      }
    }
  )

  let attachmentUrl: string | null = null
  const formData = await request.formData()
  const ticketId = formData.get("ticketId") as string
  const content = formData.get("content") as string
  const attachment = formData.get("attachment") as File | null

  if (attachment) {
    const fileExt = attachment.name.split(".").pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from("ticket_attachments")
      .upload(filePath, attachment)

    if (uploadError) {
      console.error("Storage Error:", uploadError)
      return NextResponse.json(
        { message: "خطا در آپلود فایل" },
        { status: 500 }
      )
    }

    const { data } = supabaseAdmin.storage
      .from("ticket_attachments")
      .getPublicUrl(filePath)
    attachmentUrl = data.publicUrl
  }

  const { data: newMessage, error: messageError } = await supabaseAdmin
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      user_id: user.id,
      content: content,
      is_admin_reply: true,
      attachment_url: attachmentUrl
    })
    .select()
    .single()

  if (messageError) {
    console.error("Error inserting message:", messageError)
    return NextResponse.json({ message: "خطا در ثبت پیام" }, { status: 500 })
  }

  const { error: updateError } = await supabaseAdmin
    .from("tickets")
    .update({
      status: "in-progress",
      updated_at: new Date().toISOString()
    })
    .eq("id", ticketId)

  if (updateError) {
    console.error("Error updating ticket:", updateError)
  }

  return NextResponse.json(newMessage)
}

export async function PUT(request: Request) {
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

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return undefined
        },
        set(name: string, value: string, options: CookieOptions) {
          // Do nothing
        },
        remove(name: string, options: CookieOptions) {
          // Do nothing
        }
      }
    }
  )

  const { ticketId } = await request.json()

  if (!ticketId) {
    return NextResponse.json(
      { message: "شناسه تیکت لازم است" },
      { status: 400 }
    )
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("tickets")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .select()
    .single()

  if (error) {
    console.error("Error closing ticket:", error)
    return NextResponse.json({ message: "خطا در بستن تیکت" }, { status: 500 })
  }

  const { data: userData } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("id", ticket.user_id)
    .single()

  const formattedUpdatedTicket = {
    ...ticket,
    user: {
      email: userData?.email || "کاربر نامشخص"
    }
  }

  return NextResponse.json(formattedUpdatedTicket)
}
