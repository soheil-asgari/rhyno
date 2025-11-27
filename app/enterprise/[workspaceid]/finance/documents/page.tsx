"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  FiDownload,
  FiPrinter,
  FiSearch,
  FiEye,
  FiFileText,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiArrowRight,
  FiFilter,
  FiCalendar,
  FiX
} from "react-icons/fi"
import { FilePreviewModal } from "@/components/finance/FilePreviewModal"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

// --- ایمپورت‌های تقویم ---
import DatePicker, { DateObject } from "react-multi-date-picker"
import persian from "react-date-object/calendars/persian"
import persian_fa from "react-date-object/locales/persian_fa"
import gregorian from "react-date-object/calendars/gregorian"
import gregorian_en from "react-date-object/locales/gregorian_en"

// --- اصلاح تایپ مطابق با دیتابیس ---
type DocRecord = {
  id: string
  created_at: string
  supplier_name: string | null
  amount: number | null
  payment_date: string | null
  tracking_code: string | null
  receipt_image_url: string | string[] | null
  status: string | null
  description?: string | null
  type?: "deposit" | "withdrawal" | null
  counterparty?: string | null
}

const CustomDateInput = ({
  openCalendar,
  value,
  handleValueChange,
  placeholder
}: any) => {
  return (
    <div className="relative cursor-pointer" onClick={openCalendar}>
      <FiCalendar className="absolute right-3 top-3 z-10 text-gray-500" />
      <Input
        value={value}
        onChange={handleValueChange}
        placeholder={placeholder}
        className="h-11 rounded-xl border-gray-200 bg-white pr-10 text-center font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500"
        readOnly
      />
    </div>
  )
}

export default function DocumentsArchivePage({
  params
}: {
  params: { workspaceid: string }
}) {
  const router = useRouter()
  const [records, setRecords] = useState<DocRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState<{
    start: DateObject | null
    end: DateObject | null
  }>({ start: null, end: null })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedDocId, setSelectedDocId] = useState<string>("")

  useEffect(() => {
    console.log("Current Workspace ID:", params.workspaceid)
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    setLoading(true)
    console.log("Fetching documents...")

    let query = supabase
      .from("payment_requests")
      .select("*")
      .eq("workspace_id", params.workspaceid)
      .order("created_at", { ascending: false })

    if (dateFilter.start) {
      const startDate = new DateObject(dateFilter.start)
        .convert(gregorian, gregorian_en)
        .format("YYYY-MM-DD")
      query = query.gte("payment_date", startDate)
    }

    if (dateFilter.end) {
      const endDate = new DateObject(dateFilter.end)
        .convert(gregorian, gregorian_en)
        .format("YYYY-MM-DD")
      query = query.lte("payment_date", endDate)
    }

    const { data, error } = await query

    if (error) {
      toast.error("خطا در دریافت اسناد: " + error.message)
      console.error("Supabase Error:", error)
    } else {
      console.log("Data received:", data)
      setRecords(data as DocRecord[])
    }
    setLoading(false)
  }

  const clearFilters = () => {
    setDateFilter({ start: null, end: null })
    setSearchTerm("")
    setTimeout(fetchDocuments, 100)
  }

  const filteredRecords = records.filter(
    r =>
      (r.supplier_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (r.tracking_code || "").includes(searchTerm) ||
      (r.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.counterparty || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getMainUrl = (url: string | string[] | null) => {
    if (!url) return ""
    const finalUrl = Array.isArray(url) ? url[0] : url
    return finalUrl.replace(/"/g, "")
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-10 font-sans">
      {/* --- هدر صفحه --- */}
      <div className="sticky top-0 z-20 flex flex-col items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          {/* 👇 دکمه بازگشت (Back Button) 👇 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full border border-gray-100 text-gray-500 shadow-sm hover:bg-gray-100"
            title="بازگشت به صفحه قبل"
          >
            {/* در زبان فارسی، فلش راست یعنی بازگشت */}
            <FiArrowRight size={20} />
          </Button>

          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-800">
              آرشیو اسناد مالی
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              مدیریت تراکنش‌های ثبت شده توسط هوش مصنوعی
            </p>
          </div>
        </div>

        <div className="flex w-full gap-2 md:w-auto">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="hidden border-gray-200 text-gray-600 hover:bg-gray-50 md:flex"
          >
            <FiPrinter className="mr-2" /> چاپ
          </Button>
          <Button className="flex-1 bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 md:flex-none">
            <FiDownload className="mr-2" /> خروجی اکسل
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* --- فیلترها --- */}
        <Card className="rounded-2xl border-none bg-white shadow-sm">
          <CardContent className="flex flex-col items-end gap-5 p-5 md:flex-row">
            <div className="w-full flex-1">
              <label className="mb-2 block text-xs font-semibold text-gray-600">
                جستجو در اسناد
              </label>
              <div className="relative">
                <FiSearch className="absolute right-3 top-3 text-gray-400" />
                <Input
                  placeholder="نام طرف حساب، کد رهگیری..."
                  className="h-11 rounded-xl border-gray-200 bg-white pr-10"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex w-full gap-4 md:w-auto">
              <div className="w-full md:w-40">
                <label className="mb-2 block text-xs font-semibold text-gray-600">
                  از تاریخ
                </label>
                <DatePicker
                  value={dateFilter.start}
                  onChange={val =>
                    setDateFilter({ ...dateFilter, start: val as DateObject })
                  }
                  calendar={persian}
                  locale={persian_fa}
                  render={<CustomDateInput placeholder="انتخاب کنید" />}
                />
              </div>
              <div className="w-full md:w-40">
                <label className="mb-2 block text-xs font-semibold text-gray-600">
                  تا تاریخ
                </label>
                <DatePicker
                  value={dateFilter.end}
                  onChange={val =>
                    setDateFilter({ ...dateFilter, end: val as DateObject })
                  }
                  calendar={persian}
                  locale={persian_fa}
                  render={<CustomDateInput placeholder="انتخاب کنید" />}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={fetchDocuments}
                className="h-11 rounded-xl bg-[#1e293b] px-6 text-white hover:bg-black"
              >
                <FiFilter className="mr-2" /> اعمال فیلتر
              </Button>
              {(dateFilter.start || dateFilter.end || searchTerm) && (
                <Button
                  onClick={clearFilters}
                  variant="outline"
                  className="h-11 rounded-xl border-red-100 px-4 text-red-500 hover:bg-red-50"
                >
                  <FiX />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* --- جدول --- */}
        <Card className="overflow-hidden rounded-2xl border-none bg-white shadow-lg shadow-gray-200/50">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px] md:min-w-full">
              <TableHeader className="border-b border-gray-100 bg-gray-50">
                <TableRow>
                  <TableHead className="w-[60px] text-center">#</TableHead>
                  <TableHead className="text-right">تصویر</TableHead>
                  <TableHead className="text-right">نوع تراکنش</TableHead>
                  <TableHead className="text-right">طرف حساب / شرح</TableHead>
                  <TableHead className="pl-8 text-left">مبلغ (ریال)</TableHead>
                  <TableHead className="text-center">تاریخ</TableHead>
                  <TableHead className="text-center">کد رهگیری</TableHead>
                  <TableHead className="text-center">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="mr-2 inline animate-spin" /> در حال
                      دریافت...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-48 text-center text-gray-400"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <FiFileText size={40} className="mb-3 opacity-20" />
                        <span>هیچ سندی یافت نشد.</span>
                        <span className="mt-2 text-xs">
                          RLS دیتابیس یا فیلتر تاریخ را چک کنید.
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((doc, index) => (
                    <TableRow key={doc.id} className="hover:bg-gray-50/80">
                      <TableCell className="text-center text-gray-400">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        {doc.receipt_image_url ? (
                          <div
                            className="relative size-10 cursor-pointer overflow-hidden rounded-lg border border-gray-100 transition-all hover:scale-110"
                            onClick={() => {
                              setPreviewUrl(getMainUrl(doc.receipt_image_url))
                              setSelectedDocId(doc.id) // ✅✅✅ این خط حیاتی است
                            }}
                          >
                            <img
                              src={getMainUrl(doc.receipt_image_url)}
                              className="size-full object-cover"
                              alt="سند"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {doc.type === "deposit" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-[11px] font-medium text-green-700">
                            <FiArrowDownLeft /> واریز
                          </span>
                        ) : doc.type === "withdrawal" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
                            <FiArrowUpRight /> برداشت
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-800">
                            {doc.supplier_name || "ناشناس"}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {doc.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="pl-8 text-left font-mono font-bold">
                        {doc.amount ? Number(doc.amount).toLocaleString() : "0"}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-gray-500">
                        {doc.payment_date
                          ? new DateObject(doc.payment_date)
                              .convert(persian, persian_fa)
                              .format("YYYY/MM/DD")
                          : "-"}
                      </TableCell>
                      <TableCell className="rounded-md bg-gray-50 text-center font-mono text-xs">
                        {doc.tracking_code || "---"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPreviewUrl(getMainUrl(doc.receipt_image_url))
                            setSelectedDocId(doc.id) // ✅✅✅ این خط حیاتی است
                          }}
                        >
                          <FiEye />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {previewUrl && (
          <FilePreviewModal
            isOpen={!!previewUrl}
            onClose={() => setPreviewUrl(null)}
            fileUrl={previewUrl}
            fileType="image"
            workspaceId={params.workspaceid} // آی‌دی ورک‌اسپیس
            requestId={selectedDocId} // آی‌دی سندی که کلیک شده
          />
        )}
      </div>
    </div>
  )
}
