// app/tickets/page.tsx

"use client"

import { supabase } from "../../lib/supabase/client" // ✔️ استفاده از کلاینت متمرکز و صحیح
import type { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { toast } from "sonner"

// --- کامپوننت‌های UI ---
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { Tables } from "@/supabase/types"

// --- ایمپورت آیکون‌ها از فایل جداگانه ---
import {
  IconArrowLeft,
  IconMessageCircle,
  IconPlus,
  IconSend,
  IconTicket
} from "./icons"

// --- تعریف Type ها ---
type Ticket = Tables<"tickets">
type TicketMessage = Tables<"ticket_messages">

export default function TicketsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [view, setView] = useState<"list" | "details" | "create">("list")
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newTicketSubject, setNewTicketSubject] = useState("")
  const [newTicketContent, setNewTicketContent] = useState("")
  const [replyContent, setReplyContent] = useState("")

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      const {
        data: { user }
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // به لطف RLS، این کوئری به صورت خودکار فقط تیکت‌های کاربر لاگین کرده را برمی‌گرداند
        const { data, error } = await supabase
          .from("tickets")
          .select("*")
          .order("updated_at", { ascending: false })

        if (error) {
          toast.error("خطا در دریافت تیکت‌ها.")
          console.error("Fetch tickets error:", error)
        } else {
          setTickets(data || [])
        }
      }
      setLoading(false)
    }

    fetchInitialData()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user
        setUser(currentUser ?? null)
        if (!currentUser) {
          // اگر کاربر خارج شد
          setTickets([])
          setView("list")
        }
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true)
    const { data, error } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })

    if (error) {
      toast.error("خطا در دریافت پیام‌ها")
    } else {
      setMessages(data || [])
    }
    setLoadingMessages(false)
  }

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    fetchMessages(ticket.id)
    setView("details")
  }

  const handleCreateTicket = async () => {
    if (!user) {
      toast.error("لطفاً ابتدا وارد شوید.")
      return
    }
    if (!newTicketSubject.trim() || !newTicketContent.trim()) {
      toast.error("لطفاً موضوع و متن تیکت را وارد کنید.")
      return
    }
    setIsSubmitting(true)

    const { data: newTicket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        user_id: user.id,
        subject: newTicketSubject.trim(),
        status: "open"
      })
      .select()
      .single()

    if (ticketError || !newTicket) {
      toast.error("خطا در ایجاد تیکت جدید.")
      setIsSubmitting(false)
      return
    }

    const { error: messageError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: newTicket.id,
        user_id: user.id,
        content: newTicketContent.trim()
      })

    if (messageError) {
      toast.error("خطا در ثبت اولین پیام تیکت.")
      await supabase.from("tickets").delete().eq("id", newTicket.id)
      setIsSubmitting(false)
      return
    }

    toast.success("تیکت شما با موفقیت ثبت شد.")
    setTickets(prev =>
      [newTicket, ...prev].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    )
    setNewTicketSubject("")
    setNewTicketContent("")
    setView("list")
    setIsSubmitting(false)
  }

  const handleSendReply = async () => {
    if (!user || !selectedTicket || !replyContent.trim()) return
    setIsSubmitting(true)

    const { data: newMessage, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: selectedTicket.id,
        user_id: user.id,
        content: replyContent.trim(),
        is_admin_reply: false
      })
      .select()
      .single()

    if (error || !newMessage) {
      toast.error("خطا در ارسال پاسخ.")
      setIsSubmitting(false)
      return
    }

    const { data: updatedTicket } = await supabase
      .from("tickets")
      .update({ updated_at: new Date().toISOString(), status: "open" })
      .eq("id", selectedTicket.id)
      .select()
      .single()

    if (updatedTicket) {
      setSelectedTicket(updatedTicket)
      setTickets(prev =>
        prev
          .map(t => (t.id === updatedTicket.id ? updatedTicket : t))
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime()
          )
      )
    }

    setMessages(prev => [...prev, newMessage])
    setReplyContent("")
    toast.success("پاسخ شما ارسال شد.")
    setIsSubmitting(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <Badge className="font-vazir bg-green-500 hover:bg-green-600">
            باز
          </Badge>
        )
      case "in-progress":
        return (
          <Badge className="font-vazir bg-blue-500 hover:bg-blue-600">
            پاسخ داده شد
          </Badge>
        )
      case "closed":
        return <Badge variant="secondary">بسته شده</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="font-vazir flex h-screen items-center justify-center">
        <p>در حال بارگذاری...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="font-vazir flex h-screen flex-col items-center justify-center">
        <h1 className="font-vazir mb-4 text-2xl">لطفا وارد شوید</h1>
        <p className="font-vazir mb-4">
          برای دسترسی به تیکت‌ها، باید وارد حساب کاربری خود شوید.
        </p>
        <Button asChild>
          <a href="/login">صفحه ورود</a>
        </Button>
      </div>
    )
  }

  const renderContent = () => {
    switch (view) {
      case "details":
        if (!selectedTicket) return null
        return (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setView("list")}
                    className="mb-4"
                  >
                    <IconArrowLeft />
                  </Button>
                  <CardTitle>{selectedTicket.subject}</CardTitle>
                  <CardDescription>
                    آخرین بروزرسانی:{" "}
                    {new Date(selectedTicket.updated_at).toLocaleString(
                      "fa-IR"
                    )}
                  </CardDescription>
                </div>
                {getStatusBadge(selectedTicket.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-vazir bg-muted/50 max-h-[400px] space-y-4 overflow-y-auto rounded-md border p-4">
                {loadingMessages ? (
                  <Skeleton className="h-24 w-full" />
                ) : messages.length > 0 ? (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col rounded-lg p-3 ${msg.is_admin_reply ? "bg-background items-start" : "items-end bg-blue-50 dark:bg-blue-900/30"}`}
                    >
                      <p className="whitespace-pre-wrap text-sm">
                        {msg.content}
                      </p>
                      <span className="font-vazir text-muted-foreground mt-2 text-xs">
                        {new Date(msg.created_at).toLocaleString("fa-IR")}
                        {msg.is_admin_reply ? " - (پشتیبانی)" : " - (شما)"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="font-vazir text-muted-foreground py-8 text-center">
                    هنوز پیامی در این تیکت وجود ندارد.
                  </p>
                )}
              </div>
            </CardContent>
            {selectedTicket.status !== "closed" && (
              <CardFooter className="font-vazir flex flex-col items-stretch gap-2">
                <Textarea
                  placeholder="پاسخ خود را اینجا بنویسید..."
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
                  rows={4}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={isSubmitting || !replyContent.trim()}
                >
                  <IconSend className="ml-2 size-4" />
                  {isSubmitting ? "در حال ارسال..." : "ارسال پاسخ"}
                </Button>
              </CardFooter>
            )}
          </Card>
        )
      case "create":
        return (
          <Card>
            <CardHeader>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView("list")}
                className="mb-4"
              >
                <IconArrowLeft />
              </Button>
              <CardTitle>ایجاد تیکت جدید</CardTitle>
              <CardDescription>
                مشکل یا سوال خود را با جزئیات کامل مطرح کنید.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">موضوع</Label>
                <Input
                  id="subject"
                  value={newTicketSubject}
                  onChange={e => setNewTicketSubject(e.target.value)}
                  placeholder="مثال: مشکل در افزایش اعتبار"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">متن پیام</Label>
                <Textarea
                  id="content"
                  value={newTicketContent}
                  onChange={e => setNewTicketContent(e.target.value)}
                  placeholder="لطفاً جزئیات کامل مشکل خود را در اینجا بنویسید..."
                  rows={6}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleCreateTicket}
                disabled={
                  isSubmitting ||
                  !newTicketSubject.trim() ||
                  !newTicketContent.trim()
                }
              >
                <IconSend className="ml-2 size-4" />
                {isSubmitting ? "در حال ارسال..." : "ارسال تیکت"}
              </Button>
            </CardFooter>
          </Card>
        )
      default: // 'list' view
        return (
          <Card>
            <CardHeader>
              <div className="font-vazir flex items-center justify-between">
                <div>
                  <CardTitle>تیکت‌های شما</CardTitle>
                  <CardDescription>لیست تیکت‌های پشتیبانی شما.</CardDescription>
                </div>
                <Button onClick={() => setView("create")}>
                  <IconPlus className="ml-2 size-4" />
                  ایجاد تیکت جدید
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map(ticket => (
                    <div
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className="font-vazir hover:bg-muted/50 flex cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors"
                    >
                      <div className="font-vazir flex items-center gap-4">
                        <IconTicket className="font-vazir text-muted-foreground" />
                        <div>
                          <p className="font-semibold">{ticket.subject}</p>
                          <p className="text-muted-foreground text-sm">
                            آخرین بروزرسانی:{" "}
                            {new Date(ticket.updated_at).toLocaleString(
                              "fa-IR"
                            )}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(ticket.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="font-vazir text-muted-foreground py-12 text-center">
                  <IconMessageCircle className="font-vazir mx-auto mb-4 size-12" />
                  <p>هیچ تیکتی برای نمایش وجود ندارد.</p>
                  <p className="mt-1 text-sm">
                    برای شروع، یک تیکت جدید ایجاد کنید.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="container mx-auto max-w-4xl p-4">{renderContent()}</div>
  )
}
