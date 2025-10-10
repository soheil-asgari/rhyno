// 🎯 مسیر فایل: app/payment/success/page.tsx (نسخه نهایی و بهبود یافته)

"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { IconCircleCheckFilled } from "@tabler/icons-react"
import { Suspense } from "react"

function PaymentSuccessComponent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refId = searchParams.get("ref_id")

  const REDIRECT_TO = "/" // <-- به صفحه اصلی هدایت می‌کنیم
  // شما می‌توانید این بخش را برای حذف ریدایرکت خودکار کامنت کنید
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     router.push(REDIRECT_TO);
  //   }, 5000); // 5 ثانیه زمان برای خواندن پیام

  //   return () => clearTimeout(timer);
  // }, [router]);

  return (
    // تغییر ۱: اضافه کردن w-full و p-4 برای فاصله گرفتن از لبه‌های صفحه
    <div className="font-vazir flex min-h-screen w-full flex-col items-center justify-center bg-gray-50 p-4 text-center dark:bg-gray-950">
      {/* تغییر ۲: اضافه کردن w-full و md:max-w-lg برای واکنش‌گرایی کارت اصلی */}
      <div className="font-vazir w-full max-w-md rounded-lg bg-white p-6 shadow-lg md:max-w-lg md:p-8 dark:bg-gray-900">
        <IconCircleCheckFilled
          className=" font-vazir mx-auto mb-4 text-green-500"
          size={64}
        />

        <h1 className="font-vazir mb-2 text-2xl font-bold text-gray-800 dark:text-white">
          پرداخت شما با موفقیت انجام شد
        </h1>

        <p className="font-vazir mb-6 text-gray-600 dark:text-gray-300">
          از خرید شما سپاسگزاریم.
        </p>

        {refId && (
          <div className="font-vazir mb-8 rounded-md bg-gray-100 p-3 dark:bg-gray-700/50">
            <span className="font-vazir text-sm text-gray-500 dark:text-gray-400">
              کد رهگیری:
            </span>
            <p className="font-mono text-lg font-semibold tracking-widest text-gray-700 dark:text-gray-200">
              {refId}
            </p>
          </div>
        )}

        <p className="font-vazir mb-6 text-sm text-gray-500 dark:text-gray-400">
          تا چند لحظه دیگر به صفحه چت منتقل خواهید شد...
        </p>

        <Link
          href={REDIRECT_TO}
          className="font-vazir inline-block w-full rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          انتقال به صفحه چت
        </Link>
      </div>
    </div>
  )
}

// کامپوننت اصلی که از Suspense استفاده می‌کند
export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="font-vazir flex min-h-screen w-full items-center justify-center text-white">
          در حال بارگذاری اطلاعات پرداخت...
        </div>
      }
    >
      <PaymentSuccessComponent />
    </Suspense>
  )
}
