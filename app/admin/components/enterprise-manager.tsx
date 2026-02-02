"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// ✅ اصلاح نام ایمپورت
import { createEnterpriseAccount } from "../actions"
import { toast } from "sonner"

export function EnterpriseManager() {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    // ساخت FormData از فرم
    const formData = new FormData(e.currentTarget)

    // ✅ اصلاح نحوه فراخوانی: ارسال مستقیم formData
    const res = await createEnterpriseAccount(formData)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success("اکانت سازمانی با موفقیت ساخته شد")
      // ریست کردن فرم پس از موفقیت
      e.currentTarget.reset()
      // رفرش صفحه برای آپدیت لیست
      window.location.reload()
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <h3 className="mb-4 font-bold">افزودن شرکت جدید</h3>
        <form
          onSubmit={handleSubmit}
          className="grid items-end gap-4 md:grid-cols-4"
        >
          <div>
            <label className="mb-1 block text-xs">نام شرکت</label>
            <Input
              name="company"
              placeholder="مثال: فولاد مبارکه"
              required
              className="bg-white dark:bg-black"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs">ایمیل ادمین شرکت</label>
            <Input
              name="email"
              type="email"
              placeholder="admin@company.com"
              required
              className="bg-white dark:bg-black"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs">رمز عبور اولیه</label>
            <Input
              name="password"
              type="text"
              placeholder="Password123"
              required
              className="bg-white dark:bg-black"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs">شارژ اولیه</label>
            <Input
              name="balance"
              type="number"
              placeholder="0"
              className="bg-white dark:bg-black"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "در حال ساخت..." : "ساخت اکانت"}
          </Button>
        </form>
      </div>
    </div>
  )
}
