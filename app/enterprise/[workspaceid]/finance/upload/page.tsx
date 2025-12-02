"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation" // ✅ اضافه شدن useParams
import { supabase } from "@/lib/supabase/client"
import {
  analyzeSinglePage,
  submitGroupedTransactions,
  verifyAndSettleRequest
} from "@/app/actions/finance-actions"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
// ❌ حذف Link چون باعث تداخل با Button می‌شد
import {
  FiPaperclip,
  FiSend,
  FiFile,
  FiCpu,
  FiCalendar,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiPieChart,
  FiUploadCloud,
  FiUser,
  FiCheckCircle
} from "react-icons/fi"
import { Loader2 } from "lucide-react"
import Script from "next/script"
import Image from "next/image"

// --- تایپ‌ها ---
type Transaction = {
  date: string
  time?: string
  type: "deposit" | "withdrawal"
  amount: number
  description: string
  counterparty?: string
  tracking_code?: string
}
type AIResult = {
  bank_name?: string
  account_number?: string
  transactions: Transaction[]
}
type Message = {
  id: string
  role: "user" | "system" | "ai-result"
  content?: string
  fileUrl?: string | string[]
  fileType?: string
  progress?: number
  status?: "converting" | "uploading" | "done"
  data?: AIResult
  isSubmitted?: boolean
}

declare global {
  interface Window {
    pdfjsLib: any
  }
}

// ✅ ورودی params حذف شد تا از useParams استفاده کنیم
export default function ChatUploadPage() {
  const params = useParams() // ✅ استفاده ایمن از پارامترها
  const router = useRouter()
  const workspaceId = params?.workspaceid as string // دریافت ID

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "سند خود را آپلود کنید 👇\n\nسلام 👋\nمن دستیار هوشمند مالی شما هستم.\nتصویر یا PDF صورتحساب بانکی را ارسال کنید تا آن را تحلیل و ثبت کنم."
    }
  ])
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // --- توابع پردازش (بدون تغییر) ---
  const extractTextFromPdf = async (file: File) => {
    if (!window.pdfjsLib) return ""
    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
      const pdf = await loadingTask.promise
      let fullText = ""
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ")
        fullText += `\n--- Page ${i} ---\n${pageText}`
      }
      return fullText
    } catch (e) {
      return ""
    }
  }

  const convertPdfToImages = async (
    file: File,
    onProgress: (current: number, total: number) => void
  ) => {
    if (!window.pdfjsLib) throw new Error("PDF Library loading...")
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    const images: File[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress(i, pdf.numPages)
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      canvas.height = viewport.height
      canvas.width = viewport.width
      if (context)
        await page.render({ canvasContext: context, viewport }).promise
      const img = await new Promise<File>(resolve => {
        canvas.toBlob(
          blob =>
            resolve(new File([blob!], `page_${i}.png`, { type: "image/png" })),
          "image/png"
        )
      })
      images.push(img)
    }
    return images
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0]
    if (!originalFile) return
    const msgId = Date.now().toString()
    setMessages(prev => [
      ...prev,
      {
        id: msgId,
        role: "user",
        fileType: originalFile.type,
        progress: 0,
        status: "converting",
        content: originalFile.name
      }
    ])
    setIsUploading(true)
    try {
      if (originalFile.type === "application/pdf")
        await processPdf(originalFile, msgId)
      else await processImage(originalFile, msgId)
    } catch (err: any) {
      toast.error(err.message)
      setIsUploading(false)
      setMessages(prev => prev.filter(m => m.id !== msgId))
    }
  }
  const getCleanFileName = (fileName: string) => {
    const nameWithoutExt =
      fileName.substring(0, fileName.lastIndexOf(".")) || fileName
    return nameWithoutExt.replace(/[-_]/g, " ")
  }

  const autoSaveToDatabase = async (fileUrl: string, rawFileName: string) => {
    console.log("💾 در حال ذخیره خودکار...")
    const dynamicName = getCleanFileName(rawFileName)

    const { error } = await supabase.from("payment_requests").insert({
      workspace_id: workspaceId, // ✅ استفاده از متغیر جدید
      receipt_image_url: fileUrl,
      supplier_name: dynamicName,
      description: `آپلود اولیه: ${rawFileName}`,
      amount: 0,
      status: "uploaded",
      payment_date: new Date().toISOString().split("T")[0],
      type: "withdrawal"
    })

    if (error) {
      console.error("❌ خطا در ذخیره خودکار:", error.message)
    } else {
      console.log(`✅ فایل "${dynamicName}" ذخیره شد`)
      toast.success("فایل با نام " + dynamicName + " ذخیره شد")
    }
  }

  const processImage = async (file: File, msgId: string) => {
    setMessages(prev =>
      prev.map(m =>
        m.id === msgId ? { ...m, status: "uploading", progress: 10 } : m
      )
    )

    const fileName = `${Date.now()}_${file.name}`
    await supabase.storage.from("finance_docs").upload(fileName, file)
    const url = supabase.storage.from("finance_docs").getPublicUrl(fileName)
      .data.publicUrl

    await autoSaveToDatabase(url, file.name)

    setMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? { ...m, fileUrl: [url], progress: 100, status: "done" }
          : m
      )
    )
    setIsUploading(false)
    startPageByPageAnalysis([url], [])
  }

  const processPdf = async (file: File, msgId: string) => {
    const pageUrls: string[] = []
    const extractedText = await extractTextFromPdf(file)

    const images = await convertPdfToImages(file, (current, total) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? {
                ...m,
                progress: Math.round((current / total) * 40),
                status: "converting"
              }
            : m
        )
      )
    })

    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, status: "uploading" } : m))
    )

    for (let i = 0; i < images.length; i++) {
      const fileName = `${Date.now()}_page_${i}.png`
      await supabase.storage.from("finance_docs").upload(fileName, images[i])
      const url = supabase.storage.from("finance_docs").getPublicUrl(fileName)
        .data.publicUrl
      pageUrls.push(url)
      await autoSaveToDatabase(url, `صفحه ${i + 1} از ${file.name}`)

      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? {
                ...m,
                progress: 40 + Math.round(((i + 1) / images.length) * 60)
              }
            : m
        )
      )
    }

    setMessages(prev =>
      prev.map(m =>
        m.id === msgId
          ? { ...m, fileUrl: pageUrls, progress: 100, status: "done" }
          : m
      )
    )
    setIsUploading(false)
    startPageByPageAnalysis(
      pageUrls,
      Array(pageUrls.length).fill(extractedText)
    )
  }

  const startPageByPageAnalysis = async (urls: string[], texts: string[]) => {
    setIsAnalyzing(true)
    const analyzingMsgId = "analyzing-" + Date.now()
    setMessages(prev => [
      ...prev,
      {
        id: analyzingMsgId,
        role: "system",
        content: `در حال خواندن ${urls.length} صفحه...`
      }
    ])
    const finalResult: AIResult = {
      bank_name: "",
      account_number: "",
      transactions: []
    }
    for (let i = 0; i < urls.length; i++) {
      setMessages(prev =>
        prev.map(m =>
          m.id === analyzingMsgId
            ? {
                ...m,
                content: `در حال آنالیز صفحه ${i + 1} از ${urls.length}...`
              }
            : m
        )
      )
      const res = await analyzeSinglePage(urls[i], i + 1, texts[i] || "")
      if (res.success && res.data) {
        if (!finalResult.bank_name) finalResult.bank_name = res.data.bank_name
        if (!finalResult.account_number)
          finalResult.account_number = res.data.account_number
        if (res.data.transactions)
          finalResult.transactions.push(...res.data.transactions)
      }
    }
    setMessages(prev => prev.filter(m => m.id !== analyzingMsgId))
    setIsAnalyzing(false)
    if (finalResult.transactions.length === 0) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          content: "❌ هیچ تراکنشی پیدا نشد. لطفا کیفیت تصویر را بررسی کنید."
        }
      ])
    } else {
      // 1. نمایش نتیجه به کاربر (تا ببیند چه چیزی قرار است ثبت شود)
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ai-result",
          data: finalResult,
          fileUrl: urls
        }
      ])

      // 2. 🔥 شروع عملیات ثبت خودکار (بدون نیاز به کلیک دکمه)
      console.log("🤖 Auto-submitting to Rahkaran...")
      await handleConfirm(finalResult, urls)
    }
  }

  const groupTransactionsByDate = (transactions: Transaction[]) => {
    const groups: Record<string, Transaction[]> = {}
    transactions?.forEach(tx => {
      const date = tx.date || "نامشخص"
      if (!groups[date]) groups[date] = []
      groups[date].push(tx)
    })
    return groups
  }

  const handleConfirm = async (data: AIResult, fileUrls: string | string[]) => {
    const toastId = toast.loading("در حال ذخیره و ارسال به راهکاران...")

    const groups = groupTransactionsByDate(data.transactions)
    const mainUrl = Array.isArray(fileUrls) ? fileUrls[0] : fileUrls

    const groupedPayload = Object.keys(groups).map(date => ({
      date,
      transactions: groups[date],
      fileUrl: mainUrl
    }))

    // 1. ذخیره در Supabase
    const res = await submitGroupedTransactions(workspaceId, groupedPayload)

    if (res.success && res.ids && res.ids.length > 0) {
      toast.loading("در حال دریافت شماره سند از راهکاران...", { id: toastId })

      let successCount = 0
      let rahkaranDocIds: string[] = [] // آرایه برای ذخیره شماره سندها

      // 2. ارسال به راهکاران
      for (const id of res.ids) {
        try {
          const syncRes = await verifyAndSettleRequest(
            id,
            workspaceId,
            mainUrl,
            mainUrl
          )

          if (syncRes.success) {
            successCount++
            // فرض بر این است که syncRes.reason شامل شماره سند است یا شما docId را برمی‌گردانید
            // اگر در verifyAndSettleRequest مقدار docId را برمی‌گردانید، اینجا آن را بگیرید
            if (syncRes.reason)
              rahkaranDocIds.push(syncRes.reason.replace("ثبت شد: ", ""))
          }
        } catch (e) {
          console.error(e)
        }
      }

      toast.dismiss(toastId)

      if (successCount > 0) {
        toast.success(`✅ عملیات موفقیت‌آمیز بود!`)

        const docIdsString = rahkaranDocIds.join(" , ")

        setMessages(prev => {
          // الف) اول پیام کارت هوشمند (ai-result) را پیدا میکنیم و وضعیتش را تغییر میدهیم
          const updatedMessages = prev.map(m => {
            if (m.role === "ai-result" && !m.isSubmitted) {
              return { ...m, isSubmitted: true } // ✅ وضعیت ثبت شده را true میکنیم
            }
            return m
          })

          // ب) حالا پیام سیستم (نتیجه نهایی) را به ته لیست اضافه میکنیم
          return [
            ...updatedMessages,
            {
              id: Date.now().toString(),
              role: "system",
              content: `✅ **سند حسابداری با موفقیت صادر شد.**\n\n📄 **شماره اسناد راهکاران:** ${docIdsString || "ثبت شده"}\n\nتعداد تراکنش: ${successCount}`
            }
          ]
        })
      } else {
        toast.error("❌ خطا در ثبت سند در راهکاران.")
      }
    } else {
      toast.dismiss(toastId)
      toast.error(res.error || "خطا در ذخیره اولیه اسناد")
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-gray-50 font-sans">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
        onLoad={() => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
          setPdfLibLoaded(true)
        }}
      />

      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="flex items-center gap-2 text-sm font-bold text-gray-800 md:text-base">
              دستیار هوشمند مالی
            </h1>
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-600 md:text-[11px]">
              <span className="size-1.5 animate-pulse rounded-full bg-green-50" />
              متصل به راهکاران
            </span>
          </div>
        </div>

        {/* ✅ اصلاح مهم: حذف Link و استفاده از onClick */}
        <div className="flex gap-2">
          {/* نسخه دسکتاپ */}
          <Button
            variant="outline"
            size="sm"
            className="hidden rounded-xl border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 sm:flex"
            onClick={() =>
              router.push(`/enterprise/${workspaceId}/finance/documents`)
            }
          >
            <FiPieChart className="mr-2 text-gray-500" /> مشاهده گزارشات
          </Button>

          {/* نسخه موبایل */}
          <Button
            variant="ghost"
            size="icon"
            className="flex rounded-full text-gray-600 hover:bg-gray-100 sm:hidden"
            onClick={() =>
              router.push(`/enterprise/${workspaceId}/finance/documents`)
            }
          >
            <FiPieChart size={22} />
          </Button>
        </div>
      </header>

      {/* بقیه کد بدون تغییر تا پایین */}
      <div className="h-20 shrink-0" />

      <div className="scrollbar-hide mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 pb-32 sm:px-0">
        {messages.length === 1 && (
          <div className="pointer-events-none flex h-[50vh] select-none flex-col items-center justify-center text-center opacity-60">
            <div className="mb-6 flex size-24 animate-pulse items-center justify-center rounded-full bg-gray-100">
              <FiUploadCloud size={40} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-700">
              سند خود را آپلود کنید
            </h2>
            <p className="mt-2 max-w-xs text-sm text-gray-500">
              فایل PDF یا تصویر صورتحساب بانکی را بکشید و رها کنید.
            </p>
          </div>
        )}

        <div className="space-y-6 pt-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {msg.role === "system" && (
                <div className="flex max-w-[90%] items-start gap-3 sm:max-w-[80%]">
                  <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600">
                    <FiCpu size={16} />
                  </div>
                  <div className="whitespace-pre-wrap rounded-2xl rounded-tr-none border border-gray-100 bg-white p-4 text-sm leading-7 text-gray-700 shadow-sm">
                    {msg.id === "welcome" ? (
                      <>
                        <span className="mb-2 block text-base font-bold text-gray-900">
                          سند خود را آپلود کنید 👇
                        </span>
                        {msg.content?.replace(
                          "سند خود را آپلود کنید 👇\n\n",
                          ""
                        )}
                      </>
                    ) : (
                      (msg.content ?? "")
                    )}
                  </div>
                </div>
              )}

              {msg.role === "user" && (
                <div className="flex max-w-[85%] items-end gap-2">
                  <div className="rounded-2xl rounded-br-none bg-[#3b82f6] p-3 text-white shadow-lg shadow-blue-500/20">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-white/20 p-2">
                        <FiFile className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[150px] truncate text-xs font-bold">
                          {msg.content}
                        </p>
                        <p className="font-mono text-[10px] uppercase opacity-80">
                          {msg.fileType?.split("/")[1] || "FILE"}
                        </p>
                      </div>
                    </div>

                    {Array.isArray(msg.fileUrl) && (
                      <div className="mt-3 grid grid-cols-4 gap-1">
                        {msg.fileUrl.slice(0, 4).map((url, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-square overflow-hidden rounded-md border border-white/10 bg-black/20"
                          >
                            <Image
                              src={url}
                              alt="preview"
                              fill
                              className="object-cover"
                            />
                          </div>
                        ))}
                        {msg.fileUrl.length > 4 && (
                          <div className="flex items-center justify-center rounded-md bg-black/30 font-mono text-[10px] text-white">
                            +{msg.fileUrl.length - 4}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.progress !== undefined && msg.progress < 100 && (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[9px] opacity-90">
                          <span>
                            {msg.status === "converting"
                              ? "آنالیز PDF..."
                              : "آپلود..."}
                          </span>
                          <span>{msg.progress}%</span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-black/20">
                          <div
                            className="h-full bg-white transition-all duration-300 ease-out"
                            style={{ width: `${msg.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex size-6 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-500">
                    <FiUser />
                  </div>
                </div>
              )}

              {msg.role === "ai-result" && msg.data && (
                <div className="mr-11 w-full max-w-lg">
                  <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-gray-200/50">
                    <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-800">
                          {msg.data.bank_name || "صورتحساب شناسایی شده"}
                        </h3>
                        <p className="mt-0.5 font-mono text-[11px] tracking-wide text-gray-500">
                          {msg.data.account_number}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">
                          تایید شده
                        </span>
                      </div>
                    </div>

                    <div className="scrollbar-thin scrollbar-thumb-gray-200 max-h-[350px] overflow-y-auto">
                      {Object.entries(
                        groupTransactionsByDate(msg.data.transactions)
                      ).map(([date, txs]) => (
                        <div key={date}>
                          <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-gray-50 bg-white/95 px-4 py-2 text-[11px] font-bold text-gray-500 backdrop-blur-sm">
                            <FiCalendar size={12} /> {date}
                          </div>
                          {txs.map((tx, idx) => (
                            <div
                              key={idx}
                              className="group flex gap-3 border-b border-gray-50 p-3 transition-colors last:border-0 hover:bg-gray-50"
                            >
                              <div
                                className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${tx.type === "deposit" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
                              >
                                {tx.type === "deposit" ? (
                                  <FiArrowDownLeft size={18} />
                                ) : (
                                  <FiArrowUpRight size={18} />
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col justify-center">
                                <div className="mb-0.5 flex items-baseline justify-between">
                                  <span className="truncate pl-2 text-xs font-bold text-gray-800">
                                    {tx.counterparty || "تراکنش عادی"}
                                  </span>
                                  <span
                                    className={`font-mono text-xs font-bold ${tx.type === "deposit" ? "text-green-600" : "text-red-600"}`}
                                  >
                                    {Number(tx.amount).toLocaleString()}{" "}
                                    <span className="text-[9px] font-normal text-gray-400">
                                      ریال
                                    </span>
                                  </span>
                                </div>
                                <p className="line-clamp-1 text-[10px] text-gray-400">
                                  {tx.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <div
                      className={`flex items-center justify-center border-t border-gray-100 p-3 transition-colors ${msg.isSubmitted ? "bg-green-50" : "bg-gray-50"}`}
                    >
                      {msg.isSubmitted ? (
                        // ✅ حالت ثبت شده
                        <span className="flex items-center gap-2 text-xs font-bold text-green-600">
                          <FiCheckCircle className="size-4" />
                          ثبت نهایی انجام شد
                        </span>
                      ) : (
                        // ⏳ حالت در حال ثبت (لودینگ)
                        <span className="flex animate-pulse items-center gap-2 text-xs font-medium text-blue-600">
                          <Loader2 className="size-4 animate-spin" />
                          در حال ثبت اتوماتیک در راهکاران...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex animate-pulse justify-start pl-12">
              <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2 text-xs text-gray-500 shadow-sm">
                <Loader2 className="size-3.5 animate-spin text-blue-600" />
                هوش مصنوعی در حال استخراج اطلاعات...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-2 rounded-[2rem] border border-gray-100 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,application/pdf"
            className="hidden"
            title="File Upload"
            aria-label="File Upload"
          />

          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isAnalyzing}
          >
            <FiPaperclip size={20} />
          </Button>

          <div
            className="flex h-10 flex-1 cursor-pointer items-center px-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="select-none text-sm text-gray-400">
              تصویر یا PDF خود را اینجا آپلود کنید...
            </span>
          </div>

          <Button
            size="icon"
            className={`size-10 rounded-full shadow-md transition-all duration-300 ${
              isUploading
                ? "cursor-not-allowed bg-gray-300"
                : "bg-blue-600 text-white hover:scale-105 hover:bg-blue-700"
            }`}
            disabled={isUploading || isAnalyzing}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <FiSend className="ml-0.5 size-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
