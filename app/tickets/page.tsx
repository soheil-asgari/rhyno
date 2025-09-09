"use client"

import { createClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { toast } from "sonner"

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
import { Tables } from "@/supabase/types"

// --- کامپوننت‌های آیکون به صورت SVG داخلی ---
// این کار باعث می‌شود به پکیج @tabler/icons-react نیازی نباشد

const IconArrowLeft = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M5 12l14 0" />
    <path d="M5 12l6 6" />
    <path d="M5 12l6 -6" />
  </svg>
)

const IconMessageCircle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1" />
  </svg>
)

const IconPlus = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 5l0 14" />
    <path d="M5 12l14 0" />
  </svg>
)

const IconSend = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M10 14l11 -11" />
    <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />
  </svg>
)

const IconTicket = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 5l0 2" />
    <path d="M15 11l0 2" />
    <path d="M15 17l0 2" />
    <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2" />
  </svg>
)

// --- پایان بخش آیکون‌ها ---

// اتصال به Supabase
// لطفاً این مقادیر را با اطلاعات پروژه خود در فایل env. جایگزین کنید
// یا فایل browser-client خود را به درستی وارد کنید
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "YOUR_SUPABASE_URL"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY"
const supabase = createClient(supabaseUrl, supabaseAnonKey)

type Ticket = Tables<"tickets">
type TicketMessage = Tables<"ticket_messages">
type TicketWithUser = Ticket & { users?: { email: string } }

export default function TicketsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tickets, setTickets] = useState<TicketWithUser[]>([])
  const [selectedTicket, setSelectedTicket] = useState<TicketWithUser | null>(
    null
  )

  const [messages, setMessages] = useState<TicketMessage[]>([])

  const [view, setView] = useState<"list" | "details" | "create">("list")
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [newTicketSubject, setNewTicketSubject] = useState("")
  const [newTicketContent, setNewTicketContent] = useState("")
  const [replyContent, setReplyContent] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      const {
        data: { user }
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // اضافه کن برای ادمین
        if (user.email === "soheil2833@gmail.com") {
          setIsAdmin(true)
        }

        // گرفتن تیکت‌ها
        const { data, error } = await supabase
          .from("tickets")
          .select(
            `
    *,
    users!inner(email)
  `
          )
          .order("updated_at", { ascending: false })

        if (!isAdmin && user) {
          setTickets(data?.filter(t => t.user_id === user.id) || [])
        } else {
          setTickets((data || []) as TicketWithUser[])
        }
      }
      setLoading(false)
    }
    fetchInitialData()
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
      console.error("Error fetching messages:", error)
    } else {
      setMessages(data || [])
    }
    setLoadingMessages(false)
  }
  useEffect(() => {
    setLoading(true)

    // گرفتن کاربر فعلی
    const getUser = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      setUser(user || null)
      setLoading(false)
    }
    getUser()

    // گوش دادن به تغییرات ورود/خروج
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null)
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSelectTicket = (ticket: TicketWithUser) => {
    setSelectedTicket(ticket)
    fetchMessages(ticket.id)
    setView("details")
  }

  const handleCreateTicket = async () => {
    // اصلاح: trim کردن و جدا کردن مقادیر
    const subject = newTicketSubject.trim()
    const content = newTicketContent.trim()

    if (!user) {
      toast.error("لطفاً ابتدا وارد شوید.")
      return
    }

    if (!subject || !content) {
      toast.error("لطفاً موضوع و متن تیکت را وارد کنید.")
      return
    }

    setIsSubmitting(true)

    const { data: newTicket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        user_id: user.id,
        subject,
        status: "open"
      })
      .select()
      .single()

    if (ticketError || !newTicket) {
      toast.error("خطا در ایجاد تیکت جدید.")
      console.error("Error creating ticket:", ticketError)
      setIsSubmitting(false)
      return
    }

    const { error: messageError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: newTicket.id,
        user_id: user.id,
        content
      })

    if (messageError) {
      toast.error("خطا در ثبت اولین پیام تیکت.")
      console.error("Error creating first message:", messageError)
      await supabase.from("tickets").delete().eq("id", newTicket.id)
      setIsSubmitting(false)
      return
    }

    toast.success("تیکت شما با موفقیت ثبت شد.")
    setTickets([newTicket, ...tickets])
    setNewTicketSubject("")
    setNewTicketContent("")
    setView("list")
    setIsSubmitting(false)
  }

  const handleSendReply = async () => {
    if (!user || !selectedTicket || !replyContent.trim()) {
      return
    }
    setIsSubmitting(true)

    const { data: newMessage, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: selectedTicket.id,
        user_id: user.id,
        content: replyContent,
        is_admin_reply: isAdmin // اضافه کن
      })
      .select()
      .single()

    if (error || !newMessage) {
      toast.error("خطا در ارسال پاسخ.")
      console.error("Error sending reply:", error)
      setIsSubmitting(false)
      return
    }

    const { data: updatedTicket } = await supabase
      .from("tickets")
      .update({ updated_at: new Date().toISOString(), status: "in-progress" })
      .eq("id", selectedTicket.id)
      .select()
      .single()

    if (updatedTicket) {
      const ticketWithUser = updatedTicket as TicketWithUser
      setSelectedTicket(ticketWithUser)
      setTickets(
        tickets.map(t => (t.id === ticketWithUser.id ? ticketWithUser : t))
      )
    }

    setMessages([...messages, newMessage])
    setReplyContent("")
    if (updatedTicket) {
      setSelectedTicket(updatedTicket as TicketWithUser)
      setTickets(
        tickets.map(t =>
          t.id === updatedTicket.id ? (updatedTicket as TicketWithUser) : t
        )
      )
    }

    toast.success("پاسخ شما ارسال شد.")
    setIsSubmitting(false)
  }

  const getStatusBadge = (status: string) => {
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
        return <Badge>{status}</Badge>
    }
  }

  const renderContent = () => {
    switch (view) {
      case "details":
        if (!selectedTicket) return null
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="mb-1">
                    {selectedTicket.subject}
                  </CardTitle>
                  <CardDescription>
                    تاریخ ایجاد:{" "}
                    {new Date(selectedTicket.created_at).toLocaleString(
                      "fa-IR"
                    )}
                  </CardDescription>
                  {isAdmin && (
                    <p className="text-muted-foreground text-sm">
                      کاربر: {selectedTicket.users?.email || "ناشناخته"}
                    </p>
                  )}
                </div>
                {getStatusBadge(selectedTicket.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 max-h-[400px] space-y-4 overflow-y-auto rounded-md border p-4">
                {loadingMessages ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : messages.length > 0 ? (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex flex-col rounded-lg p-3 ${
                        msg.is_admin_reply
                          ? "bg-background items-start"
                          : "items-end bg-blue-50 dark:bg-blue-900/30"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm">
                        {msg.content}
                      </p>
                      <span className="text-muted-foreground mt-2 text-xs">
                        {new Date(msg.created_at).toLocaleString("fa-IR")}
                        {msg.is_admin_reply ? " - (پشتیبانی)" : ""}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    هنوز پیامی در این تیکت وجود ندارد.
                  </p>
                )}
              </div>
            </CardContent>
            {selectedTicket.status !== "closed" && (
              <CardFooter className="flex flex-col items-start gap-4">
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
                  <IconSend height={16} width={16} className="ml-2" />
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
                type="button"
                onClick={handleCreateTicket}
                disabled={
                  isSubmitting ||
                  !newTicketSubject.trim() ||
                  !newTicketContent.trim()
                }
                className="w-full sm:w-auto"
              >
                <IconSend height={16} width={16} className="ml-2" />
                {isSubmitting ? "در حال ارسال..." : "ارسال تیکت"}
              </Button>
            </CardFooter>
          </Card>
        )

      case "list":
      default:
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>
                    {isAdmin ? "تمام تیکت‌ها" : "تیکت‌های شما"}
                  </CardTitle>
                  <CardDescription>
                    {isAdmin
                      ? "لیست همه تیکت‌ها"
                      : "لیست تیکت‌های پشتیبانی شما."}
                  </CardDescription>
                </div>
                <Button onClick={() => setView("create")}>
                  <IconPlus height={16} width={16} className="ml-2" />
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
                      className="hover:bg-muted/50 flex cursor-pointer items-start justify-between rounded-lg border p-4 transition-all sm:items-center"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center">
                        <IconTicket className="text-muted-foreground ml-4 mt-1 sm:mt-0" />
                        <div>
                          <p className="font-semibold">{ticket.subject}</p>
                          <p className="text-muted-foreground text-sm">
                            آخرین بروزرسانی:{" "}
                            {new Date(ticket.updated_at).toLocaleString(
                              "fa-IR"
                            )}
                          </p>
                          {isAdmin && (
                            <p className="text-muted-foreground text-sm">
                              کاربر:{ticket.users?.email || "ناشناخته"}
                            </p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(ticket.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground py-12 text-center">
                  <IconMessageCircle
                    width={48}
                    height={48}
                    className="mx-auto mb-4"
                  />
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
  return <div className="p-4">{renderContent()}</div>
}
