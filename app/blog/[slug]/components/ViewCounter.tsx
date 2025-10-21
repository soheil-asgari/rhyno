// FILE: app/blog/[slug]/components/ViewCounter.tsx

"use client" // 👈 این کامپوننت باید در کلاینت اجرا شود

import { useEffect } from "react"

export const ViewCounter = ({ slug }: { slug: string }) => {
  useEffect(() => {
    // یک درخواست POST به API Route می‌فرستیم تا بازدید ثبت شود
    fetch(`/api/views/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }).catch(err => {
      // اگر خطایی رخ داد، فقط در کنسول لاگ می‌اندازیم
      console.error("Failed to increment view count:", err)
    })
  }, [slug]) // این افکت فقط یکبار به ازای هر اسلاگ اجرا می‌شود

  // این کامپوننت هیچ چیزی را روی صفحه رندر نمی‌کند
  return null
}
