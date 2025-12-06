"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, CheckCircle, Image as ImageIcon } from "lucide-react"
import {
  AccountSelector,
  AccountOption
} from "@/components/finance/AccountSelector"
import { approveUnspecifiedDocument } from "@/app/actions/finance-actions"

// اینترفیس داده‌های ورودی
export interface UnspecifiedItem {
  id: string
  description: string | null
  supplier_name: string | null
  amount: number | null
  receipt_image_url?: string | null | string[]
  file_url?: string | null | string[]
  status?: string
  [key: string]: any
}

// ✅ اصلاح اینترفیس برای دریافت دو لیست جداگانه
interface UnspecifiedListProps {
  items: UnspecifiedItem[]
  slAccounts: AccountOption[] // لیست معین‌ها
  dlAccounts: AccountOption[] // لیست تفصیلی‌ها
  workspaceId: string
}

export default function UnspecifiedList({
  items,
  slAccounts,
  dlAccounts,
  workspaceId
}: UnspecifiedListProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleApprove = async (
    id: string,
    slCode: string,
    dlCode: string | null,
    currentDesc: string | null
  ) => {
    if (!slCode) {
      toast.error("لطفاً حساب معین را انتخاب کنید")
      return
    }
    setLoading(id)

    // ارسال به اکشن سروری
    const result = await approveUnspecifiedDocument(
      id,
      slCode,
      dlCode,
      currentDesc,
      workspaceId
    )

    setLoading(null)

    if (!result.success) {
      toast.error(`خطا: ${result.error}`)
    } else {
      toast.success("سند با موفقیت ثبت شد")
    }
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white py-10 text-gray-400">
        <CheckCircle className="mb-2 size-10 text-green-500 opacity-50" />
        <p className="text-sm">هیچ سند نامشخصی وجود ندارد.</p>
      </div>
    )
  }

  return (
    <div className="min-h-[300px] overflow-visible rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-right text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/80 text-gray-600">
          <tr>
            <th className="w-16 p-4 text-center font-medium">تصویر</th>
            <th className="w-1/4 p-4 font-medium">شرح تراکنش</th>
            <th className="p-4 font-medium">مبلغ (ریال)</th>
            <th className="w-1/4 p-4 font-medium">حساب معین ()</th>
            <th className="w-1/4 p-4 font-medium">طرف حساب ()</th>
            <th className="p-4 font-medium">عملیات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(item => (
            <UnspecifiedRow
              key={item.id}
              item={item}
              slAccounts={slAccounts} // ✅ پاس دادن لیست معین
              dlAccounts={dlAccounts} // ✅ پاس دادن لیست تفصیلی
              onApprove={handleApprove}
              loading={loading}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UnspecifiedRow({
  item,
  slAccounts,
  dlAccounts,
  onApprove,
  loading
}: any) {
  const [selectedSL, setSelectedSL] = useState("")
  const [selectedDL, setSelectedDL] = useState("") // استیت برای تفصیلی

  // --- منطق استخراج عکس ---
  const rawImage = item.receipt_image_url || item.file_url || item.image_url
  let imageUrl: string | null = null

  if (rawImage) {
    if (Array.isArray(rawImage) && rawImage.length > 0) {
      imageUrl = rawImage[0]
    } else if (typeof rawImage === "string") {
      if (rawImage.trim().startsWith("[") || rawImage.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(rawImage)
          imageUrl = Array.isArray(parsed) ? parsed[0] : parsed
        } catch {
          imageUrl = rawImage
        }
      } else {
        imageUrl = rawImage
      }
    }
  }

  if (imageUrl) {
    imageUrl = imageUrl.replace(/"/g, "")
  }

  return (
    <tr className="group transition-colors hover:bg-gray-50/50">
      {/* 1. تصویر */}
      <td className="p-4 align-middle">
        {imageUrl ? (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block size-10 cursor-zoom-in overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:z-50 hover:scale-[2.5] hover:ring-2 hover:ring-blue-400"
          >
            <img
              src={imageUrl}
              alt="سند"
              className="size-full object-cover"
              onError={e => {
                e.currentTarget.style.display = "none"
                e.currentTarget.parentElement?.classList.add("fallback-icon")
              }}
            />
            <div className="fallback-icon hidden size-full items-center justify-center bg-gray-100 text-gray-400">
              <ImageIcon className="size-5" />
            </div>
          </a>
        ) : (
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
            <ImageIcon className="size-5" />
          </div>
        )}
      </td>

      {/* 2. شرح */}
      <td className="p-4 align-middle">
        <div className="flex items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-orange-400" />
          <span
            className="max-w-[200px] truncate font-medium text-gray-700"
            title={item.description || ""}
          >
            {item.description || "بدون شرح"}
          </span>
        </div>
        {item.supplier_name && (
          <div className="mt-1 truncate text-xs text-gray-400">
            {item.supplier_name}
          </div>
        )}
      </td>

      {/* 3. مبلغ */}
      <td className="p-4 align-middle font-mono text-xs font-medium text-gray-600">
        {item.amount ? Number(item.amount).toLocaleString() : "0"}
      </td>

      {/* 4. انتخاب معین (SL) */}
      <td className="p-4 align-middle">
        <AccountSelector
          accounts={slAccounts}
          value={selectedSL}
          onChange={setSelectedSL}
        />
      </td>

      {/* 5. انتخاب تفصیلی (DL) */}
      <td className="p-4 align-middle">
        <AccountSelector
          accounts={dlAccounts}
          value={selectedDL}
          onChange={setSelectedDL}
        />
        <div className="mr-1 mt-1 text-[10px] text-gray-400"></div>
      </td>

      {/* 6. دکمه عملیات */}
      <td className="p-4 align-middle">
        <Button
          size="sm"
          onClick={() =>
            onApprove(item.id, selectedSL, selectedDL || null, item.description)
          }
          disabled={loading === item.id || !selectedSL} // معین الزامی است
          className={`h-9 px-3 text-xs shadow-sm transition-all ${
            selectedSL
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
        >
          {loading === item.id ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            "ثبت"
          )}
        </Button>
      </td>
    </tr>
  )
}
