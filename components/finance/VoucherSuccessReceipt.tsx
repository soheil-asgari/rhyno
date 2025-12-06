import React, { useState } from "react"
import {
  CheckCircle,
  Copy,
  FileText,
  Calendar,
  User,
  CreditCard,
  Hash
} from "lucide-react"

interface VoucherSuccessProps {
  docId: string
  partyName: string
  slCode: string
  amount: number
  date: string
  description: string
  onClose?: () => void
}

export function VoucherSuccessReceipt({
  docId,
  partyName,
  slCode,
  amount,
  date,
  description,
  onClose
}: VoucherSuccessProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(docId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // فرمت‌دهی مبلغ به صورت ۳ رقم ۳ رقم
  const formattedAmount = new Intl.NumberFormat("fa-IR").format(amount)
  const displayDate = date

  return (
    <div
      className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 bg-white font-sans shadow-xl"
      dir="rtl"
    >
      {/* Header Section */}
      <div className="border-b border-green-100 bg-green-50 p-6 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 shadow-sm">
          <CheckCircle className="size-8 text-green-600" strokeWidth={2.5} />
        </div>
        <h2 className="mb-1 text-xl font-bold text-green-800">
          سند با موفقیت ثبت شد
        </h2>
        <p className="text-sm text-green-600">
          تراکنش در سیستم راهکاران نهایی شد
        </p>
      </div>

      {/* Ticket Body */}
      <div className="space-y-5 p-6">
        {/* Voucher ID (Main Highlight) */}
        <div className="group relative flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
          <span className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            شماره سند (Doc ID)
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-gray-800">
              {docId || "---"}
            </span>
            <button
              onClick={handleCopy}
              className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
              title="کپی شماره سند"
            >
              {copied ? (
                <span className="text-xs font-bold text-green-600">کپی شد</span>
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Details Grid */}
        <div className="space-y-3">
          <DetailRow
            icon={<User size={16} />}
            label="طرف حساب"
            value={partyName}
            highlight
          />
          <DetailRow
            icon={<Hash size={16} />}
            label="کد معین (SL)"
            value={slCode}
          />
          <DetailRow
            icon={<CreditCard size={16} />}
            label="مبلغ کل"
            value={`${formattedAmount} ریال`}
          />
          <DetailRow
            icon={<Calendar size={16} />}
            label="تاریخ سند"
            value={date} // استفاده مستقیم از رشته تاریخ
          />
        </div>

        {/* Description */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <FileText className="mt-1 size-4 shrink-0 text-blue-500" />
            <p className="text-sm leading-relaxed text-blue-800">
              <span className="mb-0.5 block text-xs font-semibold text-blue-400">
                شرح سند:
              </span>
              {description}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      {onClose && (
        <div className="flex justify-center border-t border-gray-100 bg-gray-50 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-95"
          >
            بستن پنجره
          </button>
        </div>
      )}
    </div>
  )
}

// Helper Component for rows
const DetailRow = ({
  icon,
  label,
  value,
  highlight = false
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) => (
  <div className="flex items-center justify-between py-1">
    <div className="flex items-center gap-2 text-gray-500">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    <span
      className={`text-sm font-bold ${highlight ? "text-gray-900" : "text-gray-700"}`}
    >
      {value}
    </span>
  </div>
)

export default VoucherSuccessReceipt
