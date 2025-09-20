"use client"

import { useState, useEffect, type ChangeEvent, useRef } from "react"
import type { User } from "@supabase/supabase-js"
import Image from "next/image"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner" // ✔️ ایمپورت toast

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
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

// --- ایمپورت آیکون‌ها ---
import { IconPaperclip, IconX, IconLock } from "@/app/tickets/icons"

// --- ایمپورت تایپ‌های دیتابیس ---
import type { Tables } from "@/supabase/types"

// --- تعریف Type های مورد نیاز ---
type TicketMessage = Tables<"ticket_messages"> & {
  attachment_url?: string | null
}
type TicketRow = Tables<"tickets">
type FormattedTicket = TicketRow & { user: { email: string | null } }

const ADMIN_EMAIL = "soheil2833@gmail.com"

// --- کامپوننت آواتار ---
const Avatar = ({ isAdmin }: { isAdmin: boolean }) => (
  <div
    className={`flex size-8 items-center justify-center rounded-full text-sm font-bold text-white ${isAdmin ? "bg-blue-600" : "bg-gray-500"}`}
  >
    {isAdmin ? "P" : "K"}
  </div>
)

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
  const [replyFile, setReplyFile] = useState<File | null>(null)
  const [replyPreview, setReplyPreview] = useState<string | null>(null)
  const replyFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const getUserSession = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUserSession()
  }, [])

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch("/api/admin")
        if (res.ok) {
          const data = (await res.json()) as FormattedTicket[]
          setTickets(data)
        } else {
          console.error("Failed to fetch tickets")
        }
      } catch (error) {
        console.error("Error fetching tickets:", error)
      }
    }

    if (user?.email === ADMIN_EMAIL) {
      fetchTickets()
    }
  }, [user])

  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true)
    setMessages([])
    const res = await fetch(`/api/admin?ticketId=${ticketId}`)
    if (res.ok) {
      const data = (await res.json()) as TicketMessage[]
      setMessages(data)
    }
    setLoadingMessages(false)
  }

  const handleSelectTicket = (ticket: FormattedTicket) => {
    setSelectedTicket(ticket)
    setReplyContent("")
    setReplyFile(null)
    setReplyPreview(null)
    fetchMessages(ticket.id)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReplyFile(file)
      setReplyPreview(URL.createObjectURL(file))
    }
  }

  const handleReplySubmit = async () => {
    if ((!replyContent.trim() && !replyFile) || !selectedTicket) return
    setIsSubmitting(true)

    const formData = new FormData()
    formData.append("ticketId", selectedTicket.id)
    formData.append("content", replyContent)
    if (replyFile) {
      formData.append("attachment", replyFile)
    }

    const res = await fetch("/api/admin", {
      method: "POST",
      body: formData
    })

    if (res.ok) {
      const newMessage = (await res.json()) as TicketMessage
      setMessages(prev => [...prev, newMessage])
      setReplyContent("")
      setReplyFile(null)
      setReplyPreview(null)
      if (replyFileRef.current) replyFileRef.current.value = ""
      toast.success("پاسخ شما با موفقیت ارسال شد.")
    } else {
      toast.error("خطا در ارسال پاسخ")
    }
    setIsSubmitting(false)
  }

  const handleCloseTicket = async () => {
    if (!selectedTicket) return
    setIsSubmitting(true)
    const res = await fetch("/api/admin", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId: selectedTicket.id })
    })

    if (res.ok) {
      const updatedTicket = (await res.json()) as FormattedTicket
      setSelectedTicket(updatedTicket)
      setTickets(prev =>
        prev.map(t => (t.id === updatedTicket.id ? updatedTicket : t))
      )
      toast.success("تیکت با موفقیت بسته شد.")
    } else {
      toast.error("خطا در بستن تیکت")
    }
    setIsSubmitting(false)
  }

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "open":
        return <Badge className="bg-green-500 hover:bg-green-600">باز</Badge>
      case "in-progress":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600">پاسخ داده شد</Badge>
        )
      case "closed":
        return <Badge variant="destructive">بسته شده</Badge>
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
    <div className="grid h-screen grid-cols-1 gap-6 p-4 md:grid-cols-3">
      <div className="col-span-1 flex flex-col">
        <h2 className="font-vazir mb-4 text-lg font-bold">لیست تیکت‌ها</h2>
        <div className="space-y-2 overflow-y-auto">
          {tickets.length > 0 ? (
            tickets.map((ticket: FormattedTicket) => (
              <div
                key={ticket.id}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${selectedTicket?.id === ticket.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted/50"}`}
                onClick={() => handleSelectTicket(ticket)}
              >
                <p className="font-vazir truncate font-semibold">
                  {ticket.subject}
                </p>
                <div className=" font-vazir mt-1 flex items-center justify-between">
                  <p className="font-vazir text-muted-foreground truncate text-xs">
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

      <div className="font-vazir col-span-2 flex flex-col">
        {selectedTicket ? (
          <Card className="flex flex-1 flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedTicket.subject}</CardTitle>
                  <CardDescription>
                    ایجاد شده در:{" "}
                    {new Date(selectedTicket.created_at).toLocaleString(
                      "fa-IR"
                    )}
                  </CardDescription>
                </div>
                {selectedTicket.status !== "closed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCloseTicket}
                    disabled={isSubmitting}
                  >
                    <IconLock className="ml-2 size-4" />
                    بستن تیکت
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="font-vazir bg-muted/50 mb-4 flex-1 space-y-4 overflow-y-auto rounded-md border p-4">
                {loadingMessages ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-3/4" />
                    <Skeleton className="h-16 w-3/4 self-end" />
                    <Skeleton className="h-12 w-1/2" />
                  </div>
                ) : messages.length > 0 ? (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 ${!msg.is_admin_reply && "flex-row-reverse"}`}
                    >
                      <Avatar isAdmin={!!msg.is_admin_reply} />
                      <div
                        className={`max-w-xl rounded-lg p-3 ${msg.is_admin_reply ? "bg-blue-600/20" : "bg-card"}`}
                      >
                        <p className="font-vazir text-sm font-bold">
                          {msg.is_admin_reply ? "پشتیبانی" : "کاربر"}
                        </p>
                        {msg.content && (
                          <p className="whitespace-pre-wrap text-sm">
                            {msg.content}
                          </p>
                        )}
                        {msg.attachment_url && (
                          <a
                            href={msg.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 block"
                          >
                            <Image
                              src={msg.attachment_url}
                              alt="Attachment"
                              width={200}
                              height={200}
                              className="rounded-md object-cover"
                            />
                          </a>
                        )}
                        <p className="text-muted-foreground mt-1 text-right text-xs">
                          {new Date(msg.created_at).toLocaleTimeString(
                            "fa-IR",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="font-vazir text-muted-foreground py-8 text-center">
                    هیچ پیامی یافت نشد.
                  </p>
                )}
              </div>
              {selectedTicket.status !== "closed" ? (
                <div className="space-y-2">
                  <Textarea
                    value={replyContent}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setReplyContent(e.target.value)
                    }
                    placeholder="پاسخ خود را بنویسید..."
                    rows={3}
                  />
                  {replyPreview && (
                    <div className="relative size-24">
                      <Image
                        src={replyPreview}
                        alt="Preview"
                        fill
                        className="rounded-md object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -right-2 -top-2 size-6 rounded-full"
                        onClick={() => {
                          setReplyFile(null)
                          setReplyPreview(null)
                          if (replyFileRef.current)
                            replyFileRef.current.value = ""
                        }}
                      >
                        <IconX className="size-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleReplySubmit}
                      disabled={
                        isSubmitting || (!replyContent.trim() && !replyFile)
                      }
                      className="grow"
                    >
                      {isSubmitting ? "در حال ارسال..." : "ارسال پاسخ"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => replyFileRef.current?.click()}
                    >
                      <IconPaperclip />
                    </Button>
                    <Input
                      type="file"
                      ref={replyFileRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="border-destructive bg-destructive/10 rounded-md border-l-4 p-4 text-center">
                  <p className="font-bold">این تیکت بسته شده است.</p>
                </div>
              )}
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
