// app/admin/components/tickets-tab.tsx
"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { replyToTicketAction, closeTicketAction } from "../actions"
import {
  FiUser,
  FiCreditCard,
  FiClock,
  FiMessageSquare,
  FiLock
} from "react-icons/fi"

// ✅ تابع کمکی برای دریافت پیام‌ها از API
const getTicketMessages = async (ticketId: string) => {
  try {
    const res = await fetch(`/api/admin?ticketId=${ticketId}`)
    if (!res.ok) return []
    return await res.json()
  } catch (error) {
    console.error(error)
    return []
  }
}

export function TicketsTab({
  tickets,
  users,
  currentAdminId
}: {
  tickets: any[]
  users: any[]
  currentAdminId: string
}) {
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState("")
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // پیدا کردن اطلاعات کامل کاربری که تیکت زده
  const ticketUser = selectedTicket
    ? users.find(u => u.id === selectedTicket.user_id)
    : null

  useEffect(() => {
    if (selectedTicket) {
      setLoadingMsg(true)
      getTicketMessages(selectedTicket.id).then(msgs => {
        setMessages(msgs || [])
        setLoadingMsg(false)
      })
    }
  }, [selectedTicket])

  const handleReply = async () => {
    if (!reply.trim()) return
    setIsSubmitting(true)

    try {
      // ✅ استفاده از نام صحیح تابع اکشن
      const res = await replyToTicketAction(
        selectedTicket.id,
        reply,
        currentAdminId
      )

      if (res.success) {
        toast.success("پاسخ ارسال شد")
        setReply("")
        // رفرش پیام‌ها
        const msgs = await getTicketMessages(selectedTicket.id)
        setMessages(msgs || [])
      } else {
        toast.error("خطا در ارسال پاسخ")
      }
    } catch (e) {
      toast.error("خطا در ارتباط با سرور")
    }
    setIsSubmitting(false)
  }

  const handleClose = async () => {
    if (!confirm("آیا از بستن این تیکت اطمینان دارید؟")) return

    // ✅ استفاده از نام صحیح تابع اکشن
    const res = await closeTicketAction(selectedTicket.id)

    if (res.success) {
      toast.success("تیکت بسته شد")
      setSelectedTicket(null)
      window.location.reload() // رفرش صفحه برای آپدیت لیست تیکت‌ها
    } else {
      toast.error("خطا در بستن تیکت")
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            باز
          </Badge>
        )
      case "in-progress":
        return (
          <Badge className="bg-blue-500 text-white hover:bg-blue-600">
            پاسخ داده شد
          </Badge>
        )
      case "closed":
        return <Badge variant="secondary">بسته شده</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="grid h-[600px] grid-cols-1 gap-6 md:grid-cols-3">
      {/* لیست تیکت‌ها */}
      <div className="space-y-2 overflow-y-auto rounded-xl border bg-white p-2 shadow-sm md:col-span-1 dark:bg-gray-900">
        {tickets.length > 0 ? (
          tickets.map(ticket => {
            const user = users.find(u => u.id === ticket.user_id)
            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`cursor-pointer rounded-lg border p-3 transition-all ${
                  selectedTicket?.id === ticket.id
                    ? "border-blue-500 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                    : "border-transparent bg-white hover:bg-gray-100 dark:bg-transparent dark:hover:bg-gray-800"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  {getStatusBadge(ticket.status)}
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <FiClock className="size-3" />
                    {new Date(ticket.created_at).toLocaleDateString("fa-IR")}
                  </span>
                </div>
                <h4 className="mb-1 truncate text-sm font-bold">
                  {ticket.subject}
                </h4>
                <p className="text-muted-foreground truncate text-xs">
                  {user?.email || "کاربر ناشناس"}
                </p>
              </div>
            )
          })
        ) : (
          <div className="text-muted-foreground flex h-40 flex-col items-center justify-center">
            <FiMessageSquare className="mb-2 size-8 opacity-50" />
            <p className="text-sm">هیچ تیکتی موجود نیست</p>
          </div>
        )}
      </div>

      {/* جزئیات چت و موجودی */}
      <div className="flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm md:col-span-2 dark:bg-gray-900">
        {selectedTicket ? (
          <>
            {/* هدر جزئیات */}
            <div className="flex items-center justify-between border-b bg-gray-50 p-4 dark:bg-gray-950">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
                  {selectedTicket.subject}
                </h3>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-gray-500">
                    <FiUser /> {ticketUser?.email}
                  </span>
                  <span className="h-3 w-px bg-gray-300 dark:bg-gray-700"></span>
                  {/* 🔥 نمایش موجودی */}
                  <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/50">
                    <FiCreditCard /> موجودی:{" "}
                    {ticketUser?.balance?.toLocaleString() || 0} ت
                  </span>
                </div>
              </div>
              {selectedTicket.status !== "closed" && (
                <Button variant="destructive" size="sm" onClick={handleClose}>
                  <FiLock className="mr-2 size-3" /> بستن تیکت
                </Button>
              )}
            </div>

            {/* چت باکس */}
            <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/30 p-4 dark:bg-black/20">
              {loadingMsg ? (
                <p className="mt-10 text-center text-sm text-gray-400">
                  در حال بارگذاری پیام‌ها...
                </p>
              ) : messages.length > 0 ? (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_admin_reply ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl p-3 text-sm shadow-sm ${
                        msg.is_admin_reply
                          ? "rounded-tr-none bg-blue-600 text-white"
                          : "rounded-tl-none border bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>

                      {msg.attachment_url && (
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          className="mt-2 block overflow-hidden rounded-lg border border-white/20"
                        >
                          <Image
                            src={msg.attachment_url}
                            alt="attachment"
                            width={200}
                            height={150}
                            className="object-cover"
                          />
                        </a>
                      )}

                      <span
                        className={`mt-1 block text-left text-[10px] ${msg.is_admin_reply ? "text-blue-100" : "text-gray-400"}`}
                      >
                        {new Date(msg.created_at).toLocaleTimeString("fa-IR", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground flex h-full flex-col items-center justify-center opacity-60">
                  <FiMessageSquare className="mb-2 size-10" />
                  <p>هیچ پیامی وجود ندارد</p>
                </div>
              )}
            </div>

            {/* ورودی متن */}
            {selectedTicket.status !== "closed" ? (
              <div className="border-t bg-white p-4 dark:bg-gray-900">
                <div className="flex gap-2">
                  <Textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="پاسخ خود را بنویسید..."
                    className="min-h-[50px] resize-none"
                  />
                  <Button
                    onClick={handleReply}
                    disabled={isSubmitting}
                    className="h-auto bg-blue-600 px-6 hover:bg-blue-700"
                  >
                    {isSubmitting ? "..." : "ارسال"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t bg-gray-100 p-3 text-center text-sm font-medium text-gray-500 dark:bg-gray-800">
                این تیکت بسته شده است و امکان ارسال پاسخ وجود ندارد.
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-gray-400">
            <FiMessageSquare className="mb-4 size-12 opacity-20" />
            <p className="text-lg font-medium">یک تیکت را انتخاب کنید</p>
            <p className="text-sm">
              برای مشاهده جزئیات و پاسخگویی روی لیست کلیک کنید.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
