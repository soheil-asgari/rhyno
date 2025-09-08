"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { IconCircleCheckFilled } from "@tabler/icons-react"

// آدرس صفحه چت یا داشبورد اصلی شما
const REDIRECT_TO = "/chat"
// مدت زمان انتظار قبل از انتقال خودکار (به میلی‌ثانیه)
const REDIRECT_DELAY = 4000 // 4 ثانیه

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refId = searchParams.get("ref_id")

  // این افکت بعد از گذشت زمان مشخص شده، کاربر را به صفحه اصلی منتقل می‌کند
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(REDIRECT_TO)
    }, REDIRECT_DELAY)

    // در صورت خروج از صفحه، تایمر را پاک می‌کنیم
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-center dark:bg-gray-900">
      <div className="mx-4 max-w-md rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
        <IconCircleCheckFilled
          className="mx-auto mb-4 text-green-500"
          size={64}
        />
        <h1 className="font-vazir mb-2 text-2xl font-bold text-gray-800 dark:text-white">
          پرداخت شما با موفقیت انجام شد
        </h1>
        <p className="font-vazir mb-4 text-gray-600 dark:text-gray-300">
          از خرید شما سپاسگزاریم.
        </p>

        {refId && (
          <div className="font-vazir mb-6 rounded-md bg-gray-100 p-3 dark:bg-gray-700">
            <span className="font-vazir text-sm text-gray-500 dark:text-gray-400">
              کد رهگیری:
            </span>
            <p className="font-mono text-lg font-semibold text-gray-700 dark:text-gray-200">
              {refId}
            </p>
          </div>
        )}

        <p className="font-vazir mb-6 text-gray-500 dark:text-gray-400">
          تا چند لحظه دیگر به صفحه چت منتقل خواهید شد...
        </p>

        <Link
          href={REDIRECT_TO}
          className="font-vazir inline-block rounded-md bg-blue-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
        >
          انتقال به صفحه چت
        </Link>
      </div>
    </div>
  )
}
