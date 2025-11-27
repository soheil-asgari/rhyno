"use client"
import { useState } from "react"
import { extractReceiptData } from "@/app/actions/ocr-actions"
import { uploadToSupabase } from "@/lib/upload-helper" // فرض بر این است که هلپر آپلود دارید
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function UploadReceiptPage() {
  const [loading, setLoading] = useState(false)
  const [ocrData, setOcrData] = useState<any>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      // ۱. آپلود فایل
      const publicUrl = await uploadToSupabase(file, "receipts")

      // ۲. خواندن اطلاعات با هوش مصنوعی
      const result = await extractReceiptData(publicUrl)

      if (result.success) {
        setOcrData({ ...result.data, image_url: publicUrl })
        toast.success("اطلاعات فیش با موفقیت استخراج شد")
      }
    } catch (err) {
      toast.error("خطا در پردازش تصویر")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitFinal = async () => {
    // فراخوانی سرور اکشن برای ذخیره در دیتابیس و ارسال به راهکاران
    // await createPaymentRequest(ocrData);
    toast.success(
      "در سیستم و راهکاران ثبت شد. پیامک برای مسئول پیگیری ارسال شد."
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-4">
      <h1 className="text-center text-xl font-bold">ثبت واریزی جدید</h1>

      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleUpload}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="block size-full cursor-pointer">
          {loading ? "در حال پردازش هوشمند..." : "📸 تصویر فیش را انتخاب کنید"}
        </label>
      </div>

      {ocrData && (
        <div className="space-y-3 rounded-lg border bg-white p-4 shadow">
          <div className="grid gap-2">
            <label>نام تامین کننده (تشخیص هوشمند):</label>
            <Input
              defaultValue={ocrData.supplier_name}
              onChange={e =>
                setOcrData({ ...ocrData, supplier_name: e.target.value })
              }
            />

            <label>مبلغ:</label>
            <Input defaultValue={ocrData.amount} />

            <label>شماره پیگیری:</label>
            <Input defaultValue={ocrData.tracking_code} />
          </div>
          <Button
            onClick={handleSubmitFinal}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            تایید و ارسال به راهکاران
          </Button>
        </div>
      )}
    </div>
  )
}
