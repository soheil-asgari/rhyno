"use client"

import { useEffect, useState } from "react"
import { FiEye } from "react-icons/fi"

export const ViewDisplay = ({ slug }: { slug: string }) => {
  const [views, setViews] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/views/${slug}`)
      .then(res => res.json())
      .then(data => setViews(data.views))
      .catch(err => console.error("Error fetching views:", err))
  }, [slug])

  // تا زمانی که عدد لود نشده، یک جای خالی یا لودینگ نشان می‌دهیم
  if (views === null) {
    return (
      <div className="flex animate-pulse items-center gap-2 text-gray-400">
        <FiEye />
        <span className="h-4 w-8 rounded bg-gray-200 dark:bg-gray-700"></span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
      <FiEye className="text-blue-500" />
      <span>{views.toLocaleString("fa-IR")} بازدید</span>
    </div>
  )
}
