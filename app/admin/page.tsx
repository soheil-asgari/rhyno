"use client"

import { useState, useEffect, type ChangeEvent } from "react"
import type { User } from "@supabase/supabase-js"
// این خط را به جای خط حذفی اضافه کنید
import { supabase } from "@/lib/supabase/client"
// --- ایمپورت کامپوننت‌های UI ---
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

// --- ایمپورت تایپ‌های دیتابیس ---
import type { Database, Tables } from "@/supabase/types"

// --- تعریف Type های مورد نیاز بر اساس ساختار Supabase ---
type TicketMessage = Tables<"ticket_messages">
type TicketRow = Tables<"tickets">
type FormattedTicket = TicketRow & { user: { email: string | null } }

const ADMIN_EMAIL = "soheil2833@gmail.com"

export default function AdminPage() {
  // --- مدیریت State ها ---
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<FormattedTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<FormattedTicket | null>(
    null
  )
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replyContent, setReplyContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 1. در اولین بارگذاری، اطلاعات کاربر لاگین کرده را می‌گیرد
  useEffect(() => {
    const getUserSession = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      console.log("BROWSER LOG: User object from Supabase:", user)
      setUser(user)
      setLoading(false)
    }
    getUserSession()
  }, [supabase])

  // 2. پس از تایید هویت ادمین، لیست تیکت‌ها را از API می‌گیرد
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        // app/admin/page.tsx -> useEffect
        const res = await fetch("/api/admin") // ✔️ این آدرس URL صحیح برای API شماست
        console.log(
          "FETCH STATUS: Response from /api/admin:",
          res.status,
          res.statusText
        ) // لاگ برای بررسی وضعیت درخواست

        if (res.ok) {
          const data = (await res.json()) as FormattedTicket[]
          console.log("FETCH SUCCESS: Data received from API:", data) // لاگ برای دیدن دیتای دریافتی
          setTickets(data)
        } else {
          const errorText = await res.text()
          console.error(
            "FETCH ERROR: Failed to fetch tickets. Response body:",
            errorText
          ) // لاگ برای دیدن متن خطا
        }
      } catch (error) {
        console.error("Error fetching tickets:", error)
      }
    }
    console.log("BROWSER LOG: Checking admin access...")
    console.log("Comparing user email:", user?.email)
    console.log("With ADMIN_EMAIL:", ADMIN_EMAIL)
    console.log("Are they equal?", user?.email === ADMIN_EMAIL)

    if (user?.email === ADMIN_EMAIL) {
      console.log("AUTH CHECK: User is admin. Fetching tickets...")
      fetchTickets()
    }
  }, [user])

  // ... (بقیه توابع بدون تغییر باقی می‌مانند)
  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true)
    setMessages([])
    // app/admin/page.tsx -> fetchMessages
    const res = await fetch(`/api/admin?ticketId=${ticketId}`) // ✔️ این آدرس هم صحیح است و نیازی به تغییر ندارد
    if (res.ok) {
      const data = (await res.json()) as TicketMessage[]
      setMessages(data)
    }
    setLoadingMessages(false)
  }

  const handleSelectTicket = (ticket: FormattedTicket) => {
    setSelectedTicket(ticket)
    fetchMessages(ticket.id)
  }

  const handleReplySubmit = async () => {
    if (!replyContent.trim() || !selectedTicket) return
    setIsSubmitting(true)

    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: selectedTicket.id,
        content: replyContent
      })
    })

    if (res.ok) {
      const newMessage = (await res.json()) as TicketMessage
      setMessages(prev => [...prev, newMessage])
      setReplyContent("")
    } else {
      alert("خطا در ارسال پاسخ")
    }
    setIsSubmitting(false)
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "open":
        return <Badge className="bg-green-500 hover:bg-green-600">باز</Badge>
      case "in-progress":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600">در حال بررسی</Badge>
        )
      case "closed":
        return <Badge variant="secondary">بسته شده</Badge>
      default:
        return <Badge>{status || "نامشخص"}</Badge>
    }
  }

  if (loading) {
    return <p className="p-8 text-center">در حال بارگذاری...</p>
  }

  if (user?.email !== ADMIN_EMAIL) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <h1 className="mb-4 text-2xl">دسترسی غیرمجاز</h1>
        <p className="mb-4">این صفحه فقط برای ادمین است.</p>
        <Button onClick={() => (window.location.href = "/login")}>
          ورود به عنوان ادمین
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-3">
      <div className="col-span-1">
        <h2 className="font-vazir mb-4 text-lg font-bold">لیست تیکت‌ها</h2>
        <div className="space-y-2">
          {tickets.length > 0 ? (
            tickets.map((ticket: FormattedTicket) => (
              <div
                key={ticket.id}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${selectedTicket?.id === ticket.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted/50"}`}
                onClick={() => handleSelectTicket(ticket)}
              >
                <p className="font-vazir font-semibold">{ticket.subject}</p>
                <div className=" font-vazir mt-1 flex items-center justify-between">
                  <p className="font-vazir text-muted-foreground text-xs">
                    {ticket.user?.email || "کاربر نامشخص"}
                  </p>
                  {getStatusBadge(ticket.status)}
                </div>
              </div>
            ))
          ) : (
            <p className="font-vazir text-muted-foreground text-center text-sm">
              هیچ تیکتی یافت نشد.
            </p>
          )}
        </div>
      </div>

      <div className="col-span-2">
        {selectedTicket ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedTicket.subject}</CardTitle>
              <CardDescription>
                ایجاد شده در:{" "}
                {new Date(selectedTicket.created_at).toLocaleString("fa-IR")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="font-vazir bg-muted/50 mb-4 h-96 space-y-4 overflow-y-auto rounded-md border p-4">
                {loadingMessages ? (
                  <p className="text-center">در حال بارگذاری پیام‌ها...</p>
                ) : messages.length > 0 ? (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col rounded-lg p-3 ${msg.is_admin_reply ? "items-start bg-blue-900/50" : "bg-card items-end"}`}
                    >
                      <p className="font-vazir text-sm font-bold">
                        {msg.is_admin_reply ? "شما (پشتیبانی)" : "کاربر"}
                      </p>
                      <p className="whitespace-pre-wrap text-sm">
                        {msg.content}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {new Date(msg.created_at).toLocaleTimeString("fa-IR")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="font-vazir text-muted-foreground py-8 text-center">
                    هیچ پیامی یافت نشد.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Textarea
                  value={replyContent}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setReplyContent(e.target.value)
                  }
                  placeholder="پاسخ خود را بنویسید..."
                  rows={4}
                />
                <Button
                  onClick={handleReplySubmit}
                  disabled={isSubmitting || !replyContent.trim()}
                >
                  {isSubmitting ? "در حال ارسال..." : "ارسال پاسخ"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="font-vazir bg-muted/50 flex h-full items-center justify-center rounded-lg">
            <p className="font-vazir text-muted-foreground">
              یک تیکت را برای مشاهده جزئیات انتخاب کنید.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
