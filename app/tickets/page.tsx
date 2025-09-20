"use client"

import { supabase } from "../../lib/supabase/client"
import type { User, RealtimeChannel } from "@supabase/supabase-js"
import { useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import Image from "next/image"

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

// --- ایمپورت آیکون‌ها ---
import {
  IconArrowLeft,
  IconMessageCircle,
  IconPaperclip,
  IconPlus,
  IconSend,
  IconTicket,
  IconX
} from "./icons"

// --- تعریف Type ها ---
type TicketMessage = Tables<"ticket_messages"> & {
  attachment_url?: string | null
}
type Ticket = Tables<"tickets">

// --- کامپوننت آواتار ---
const Avatar = ({ isAdmin }: { isAdmin: boolean }) => (
  <div
    className={`flex size-8 items-center justify-center rounded-full text-sm font-bold text-white ${isAdmin ? "bg-blue-600" : "bg-gray-500"}`}
  >
    {isAdmin ? "P" : "K"}
  </div>
)

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

  const [newTicketFile, setNewTicketFile] = useState<File | null>(null)
  const [replyFile, setReplyFile] = useState<File | null>(null)
  const [newTicketPreview, setNewTicketPreview] = useState<string | null>(null)
  const [replyPreview, setReplyPreview] = useState<string | null>(null)

  const newTicketFileRef = useRef<HTMLInputElement>(null)
  const replyFileRef = useRef<HTMLInputElement>(null)

  // ✔️ برای مدیریت اشتراک Realtime
  const channelRef = useRef<RealtimeChannel | null>(null)

  // --- افکت برای Realtime ---
  useEffect(() => {
    // اگر تیکتی انتخاب نشده، کاری نکن
    if (!selectedTicket) return

    // پاک کردن اشتراک قبلی
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    // ایجاد یک کانال جدید برای گوش دادن به تغییرات
    const channel = supabase
      .channel(`ticket_messages_${selectedTicket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${selectedTicket.id}`
        },
        payload => {
          // افزودن پیام جدید به لیست پیام‌ها
          setMessages(prevMessages => [
            ...prevMessages,
            payload.new as TicketMessage
          ])
        }
      )
      .subscribe()

    channelRef.current = channel

    // تابع پاکسازی: هنگام خروج از کامپوننت یا تغییر تیکت، اشتراک را لغو می‌کند
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [selectedTicket])

  const uploadAttachment = async (file: File): Promise<string | null> => {
    if (!user) return null

    const fileExt = file.name.split(".").pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from("ticket_attachments")
      .upload(filePath, file)

    if (uploadError) {
      console.error("Upload error:", uploadError)
      toast.error("خطا در آپلود فایل ضمیمه.")
      return null
    }

    const { data } = supabase.storage
      .from("ticket_attachments")
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "new" | "reply"
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      if (type === "new") {
        setNewTicketFile(file)
        setNewTicketPreview(URL.createObjectURL(file))
      } else {
        setReplyFile(file)
        setReplyPreview(URL.createObjectURL(file))
      }
    }
  }

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true)
      const {
        data: { user }
      } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data, error } = await supabase
          .from("tickets")
          .select("*")
          .order("updated_at", { ascending: false })

        if (error) {
          toast.error("خطا در دریافت تیکت‌ها.")
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
    setReplyContent("")
    setReplyFile(null)
    setReplyPreview(null)
    fetchMessages(ticket.id)
    setView("details")
  }

  const handleCreateTicket = async () => {
    if (!user) return toast.error("لطفاً ابتدا وارد شوید.")
    if (!newTicketSubject.trim() || !newTicketContent.trim())
      return toast.error("لطفاً موضوع و متن تیکت را وارد کنید.")

    setIsSubmitting(true)

    let attachmentUrl: string | null = null
    if (newTicketFile) {
      attachmentUrl = await uploadAttachment(newTicketFile)
      if (!attachmentUrl) {
        setIsSubmitting(false)
        return
      }
    }

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
        content: newTicketContent.trim(),
        attachment_url: attachmentUrl
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
    setNewTicketFile(null)
    setNewTicketPreview(null)
    setView("list")
    setIsSubmitting(false)
  }

  const handleSendReply = async () => {
    if (!user || !selectedTicket || (!replyContent.trim() && !replyFile)) return
    setIsSubmitting(true)

    let attachmentUrl: string | null = null
    if (replyFile) {
      attachmentUrl = await uploadAttachment(replyFile)
      if (!attachmentUrl) {
        setIsSubmitting(false)
        return
      }
    }

    const { data: newMessage, error } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: selectedTicket.id,
        user_id: user.id,
        content: replyContent.trim(),
        is_admin_reply: false,
        attachment_url: attachmentUrl
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

    // دیگر نیازی به آپدیت دستی پیام‌ها نیست چون Realtime این کار را انجام می‌دهد
    // setMessages(prev => [...prev, newMessage])

    setReplyContent("")
    setReplyFile(null)
    setReplyPreview(null)
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
        return <Badge variant="destructive">بسته شده</Badge>
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
          <Card className="flex h-[calc(100vh-2rem)] flex-col">
            <CardHeader>
              <div className="font-vazir flex items-start justify-between">
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
            <CardContent className="flex flex-1 flex-col overflow-hidden">
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
                          {msg.is_admin_reply ? "پشتیبانی" : "شما"}
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
                    هنوز پیامی در این تیکت وجود ندارد.
                  </p>
                )}
              </div>
            </CardContent>
            {selectedTicket.status !== "closed" ? (
              <CardFooter className="font-vazir flex flex-col items-stretch gap-2 border-t pt-4">
                <Textarea
                  placeholder="پاسخ خود را اینجا بنویسید..."
                  value={replyContent}
                  onChange={e => setReplyContent(e.target.value)}
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
                    onClick={handleSendReply}
                    disabled={
                      isSubmitting || (!replyContent.trim() && !replyFile)
                    }
                    className="grow"
                  >
                    <IconSend className="font-vazir ml-2 size-4" />
                    {isSubmitting ? "در حال ارسال..." : "ارسال"}
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
                    onChange={e => handleFileChange(e, "reply")}
                  />
                </div>
              </CardFooter>
            ) : (
              <CardFooter className="border-t pt-4">
                <div className="border-destructive bg-destructive/10 w-full rounded-md border-l-4 p-4 text-center">
                  <p className="font-bold">
                    این تیکت توسط پشتیبانی بسته شده است.
                  </p>
                </div>
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
                className="font-vazir mb-4"
              >
                <IconArrowLeft />
              </Button>
              <div className="font-vazir space-y-2">
                <CardTitle>ایجاد تیکت جدید</CardTitle>
                <CardDescription>
                  مشکل یا سوال خود را با جزئیات کامل مطرح کنید.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="font-vazir space-y-4">
              <div className="font-vazir space-y-2">
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
              <div className="space-y-2">
                <Label>فایل ضمیمه (اختیاری)</Label>
                {newTicketPreview ? (
                  <div className="relative size-24">
                    <Image
                      src={newTicketPreview}
                      alt="Preview"
                      fill
                      className="rounded-md object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -right-2 -top-2 size-6 rounded-full"
                      onClick={() => {
                        setNewTicketFile(null)
                        setNewTicketPreview(null)
                        if (newTicketFileRef.current)
                          newTicketFileRef.current.value = ""
                      }}
                    >
                      <IconX className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => newTicketFileRef.current?.click()}
                    className="w-full"
                  >
                    <IconPaperclip className="ml-2" />
                    انتخاب عکس
                  </Button>
                )}
                <Input
                  type="file"
                  ref={newTicketFileRef}
                  className="hidden"
                  accept="image/*"
                  onChange={e => handleFileChange(e, "new")}
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
                <IconSend className="font-vazir ml-2 size-4" />
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
                <div className="font-vazir space-y-3">
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
