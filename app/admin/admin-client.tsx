"use client"

import { useState, useRef } from "react"
import type { User } from "@supabase/supabase-js"
import Image from "next/image"
import { toast } from "sonner"
// ایمپورت دقیق نام‌هایی که در actions.ts ساختیم
import {
  createEnterpriseAccount,
  replyToTicketAction,
  closeTicketAction,
  deleteUser
} from "./actions"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"

import { IconPaperclip, IconX, IconLock } from "@/app/tickets/icons"
import {
  FiUsers,
  FiMessageSquare,
  FiCreditCard,
  FiTrash2,
  FiSearch,
  FiPlusCircle,
  FiShield
} from "react-icons/fi"

// تعریف دقیق Props
interface AdminClientPageProps {
  user: User
  initialData: {
    users: any[]
    tickets: any[]
    error?: string
  }
}

const Avatar = ({ isAdmin }: { isAdmin: boolean }) => (
  <div
    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm ${isAdmin ? "bg-blue-600" : "bg-emerald-600"}`}
  >
    {isAdmin ? "P" : "U"}
  </div>
)

export function AdminClientPage({ user, initialData }: AdminClientPageProps) {
  const [usersList, setUsersList] = useState<any[]>(initialData.users || [])
  const [tickets, setTickets] = useState<any[]>(initialData.tickets || [])

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [replyContent, setReplyContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ticketSearch, setTicketSearch] = useState("")
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [replyFile, setReplyFile] = useState<File | null>(null)
  const replyFileRef = useRef<HTMLInputElement>(null)

  const filteredTickets = tickets.filter(
    t =>
      t.subject?.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.user?.email?.toLowerCase().includes(ticketSearch.toLowerCase())
  )

  const fetchMessages = async (ticketId: string) => {
    setLoadingMessages(true)
    // برای پیام‌ها همچنان از API استفاده می‌کنیم (یا می‌توانید اکشن بسازید)
    const res = await fetch(`/api/admin?ticketId=${ticketId}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data)
    }
    setLoadingMessages(false)
  }

  const handleSelectTicket = (ticket: any) => {
    setSelectedTicket(ticket)
    fetchMessages(ticket.id)
  }

  const handleReply = async () => {
    if (!replyContent.trim() || !selectedTicket) return
    setIsSubmitting(true)
    const res = await replyToTicketAction(
      selectedTicket.id,
      replyContent,
      user.id
    )
    if (res.success) {
      toast.success("پاسخ ارسال شد")
      setReplyContent("")
      fetchMessages(selectedTicket.id)
    } else {
      toast.error("خطا در ارسال")
    }
    setIsSubmitting(false)
  }

  const handleClose = async () => {
    if (!selectedTicket) return
    const res = await closeTicketAction(selectedTicket.id)
    if (res.success) {
      toast.success("تیکت بسته شد")
      setTickets(prev =>
        prev.map(t =>
          t.id === selectedTicket.id ? { ...t, status: "closed" } : t
        )
      )
      setSelectedTicket((prev: any) =>
        prev ? { ...prev, status: "closed" } : null
      )
    }
  }

  const handleCreateEnterprise = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    setIsCreatingUser(true)
    const formData = new FormData(e.currentTarget)

    const res = await createEnterpriseAccount(formData)

    if (res.error) {
      toast.error(`خطا: ${res.error}`)
    } else {
      toast.success("کاربر سازمانی با موفقیت ساخته شد")
      window.location.reload()
    }
    setIsCreatingUser(false)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("آیا مطمئن هستید؟")) return
    const res = await deleteUser(userId)
    if (res.success) {
      toast.success("کاربر حذف شد")
      setUsersList(prev => prev.filter(u => u.id !== userId))
    } else {
      toast.error("خطا در حذف کاربر")
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: any = {
      open: "bg-green-500 hover:bg-green-600 text-white",
      "in-progress": "bg-blue-500 hover:bg-blue-600 text-white",
      closed: "bg-gray-500 text-white"
    }
    return (
      <Badge className={styles[status] || "bg-gray-500"}>
        {status === "in-progress" ? "پاسخ داده شد" : status}
      </Badge>
    )
  }

  return (
    <div
      className="font-vazir min-h-screen bg-gray-50/50 p-4 md:p-8 dark:bg-[#0f1018]"
      dir="rtl"
    >
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            پنل مدیریت یکپارچه
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            مدیریت کاربران، تیکت‌ها و مشتریان سازمانی
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-2 px-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="size-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-sm font-medium">{user.email}</span>
        </div>
      </div>

      <Tabs defaultValue="tickets" className="w-full space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 rounded-lg border bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
          <TabsTrigger value="tickets" className="gap-2">
            <FiMessageSquare /> تیکت‌ها
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <FiUsers /> کاربران
          </TabsTrigger>
          <TabsTrigger value="enterprise" className="gap-2 text-blue-600">
            <FiShield /> مشتریان سازمانی
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-0">
          <div className="grid h-[650px] grid-cols-1 gap-6 md:grid-cols-12">
            <Card className="flex flex-col overflow-hidden md:col-span-4">
              <div className="border-b p-4">
                <div className="relative">
                  <FiSearch className="absolute right-3 top-3 text-gray-400" />
                  <Input
                    placeholder="جستجو..."
                    className="pr-9"
                    value={ticketSearch}
                    onChange={e => setTicketSearch(e.target.value)}
                  />
                </div>
              </div>
              <ScrollArea className="flex-1 bg-gray-50/50 dark:bg-black/20">
                <div className="flex flex-col gap-1 p-2">
                  {filteredTickets.map(ticket => (
                    <button
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-right transition-all ${
                        selectedTicket?.id === ticket.id
                          ? "z-10 border-blue-500 bg-white shadow-md"
                          : "border-transparent bg-white hover:bg-gray-100 dark:bg-transparent dark:hover:bg-gray-800"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="truncate text-sm font-bold">
                          {ticket.subject}
                        </span>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <div className="text-muted-foreground flex w-full items-center justify-between text-xs">
                        <span>{ticket.user?.email}</span>
                        <span>
                          {new Date(ticket.created_at).toLocaleDateString(
                            "fa-IR"
                          )}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            <Card className="flex flex-col overflow-hidden md:col-span-8">
              {selectedTicket ? (
                <>
                  <div className="flex items-center justify-between border-b bg-gray-50 p-4 dark:bg-gray-900">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-lg font-bold">
                        {selectedTicket.subject}
                      </h2>
                      <span className="text-muted-foreground flex items-center gap-2 text-xs">
                        <FiUsers /> {selectedTicket.user?.email}
                        <span className="rounded-full bg-emerald-100 px-2 text-emerald-600">
                          موجودی:{" "}
                          {usersList
                            .find(u => u.id === selectedTicket.user_id)
                            ?.balance?.toLocaleString() || 0}{" "}
                          ت
                        </span>
                      </span>
                    </div>
                    {selectedTicket.status !== "closed" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleClose}
                      >
                        <IconLock className="ml-2 size-4" /> بستن
                      </Button>
                    )}
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto bg-white p-4 dark:bg-black/20">
                    {loadingMessages ? (
                      <p className="text-muted-foreground mt-10 text-center">
                        در حال بارگذاری...
                      </p>
                    ) : (
                      messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.is_admin_reply ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl p-3 text-sm ${
                              msg.is_admin_reply
                                ? "rounded-tr-none bg-blue-600 text-white"
                                : "rounded-tl-none bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          >
                            <p>{msg.content}</p>
                            {msg.attachment_url && (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                className="mt-2 block text-xs underline opacity-80"
                              >
                                مشاهده فایل ضمیمه
                              </a>
                            )}
                            <span className="mt-1 block text-left text-[10px] opacity-70">
                              {new Date(msg.created_at).toLocaleTimeString(
                                "fa-IR",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedTicket.status !== "closed" && (
                    <div className="border-t bg-gray-50 p-4 dark:bg-gray-900">
                      <div className="flex gap-2">
                        <Textarea
                          value={replyContent}
                          onChange={e => setReplyContent(e.target.value)}
                          placeholder="پاسخ خود را بنویسید..."
                          className="min-h-[50px]"
                        />
                        <Button onClick={handleReply} disabled={isSubmitting}>
                          ارسال
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center">
                  یک تیکت انتخاب کنید
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>لیست تمام کاربران ({usersList.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">کاربر</TableHead>
                    <TableHead className="text-right">نام نمایشی</TableHead>
                    <TableHead className="text-right">تاریخ عضویت</TableHead>
                    <TableHead className="text-right">کیف پول</TableHead>
                    <TableHead className="text-right">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">
                        {u.email}
                      </TableCell>
                      <TableCell>{u.display_name}</TableCell>
                      <TableCell>
                        {new Date(u.created_at).toLocaleDateString("fa-IR")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-emerald-500 text-emerald-600"
                        >
                          {u.balance?.toLocaleString()} تومان
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-500"
                        >
                          <FiTrash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enterprise">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-900/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <FiPlusCircle /> تعریف مشتری سازمانی جدید
                </CardTitle>
                <CardDescription>
                  ساخت حساب کاربری اختصاصی با ورک‌اسپیس و کیف پول اولیه.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEnterprise} className="space-y-4">
                  <div className="space-y-2">
                    <Label>نام شرکت</Label>
                    <Input
                      name="company"
                      placeholder="مثال: شرکت فولاد مبارکه"
                      required
                      className="bg-white dark:bg-black"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ایمیل ادمین</Label>
                      <Input
                        name="email"
                        type="email"
                        placeholder="admin@company.com"
                        required
                        className="bg-white dark:bg-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>رمز عبور</Label>
                      <Input
                        name="password"
                        type="text"
                        placeholder="Password123"
                        required
                        className="bg-white dark:bg-black"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>شارژ اولیه کیف پول</Label>
                    <Input
                      name="balance"
                      type="number"
                      defaultValue="0"
                      className="bg-white dark:bg-black"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={isCreatingUser}
                  >
                    {isCreatingUser ? "در حال ساخت..." : "ایجاد حساب سازمانی"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مشتریان سازمانی فعال</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {usersList.filter(
                    u => u.balance > 1000000 || u.display_name?.includes("شرکت")
                  ).length > 0 ? (
                    <div className="space-y-2">
                      {usersList
                        .filter(
                          u =>
                            u.balance > 1000000 ||
                            u.display_name?.includes("شرکت")
                        )
                        .map(u => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between rounded-lg border bg-white p-3 dark:bg-gray-900"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                                <FiShield />
                              </div>
                              <div>
                                <p className="font-bold">{u.display_name}</p>
                                <p className="text-muted-foreground text-xs">
                                  {u.email}
                                </p>
                              </div>
                            </div>
                            <Badge>{u.balance.toLocaleString()} ت</Badge>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground py-10 text-center">
                      هنوز مشتری سازمانی ثبت نشده است.
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
