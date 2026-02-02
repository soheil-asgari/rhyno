"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Loading from "@/app/loading"

export default function WorkspacePage() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    // این صفحه (`/[workspaceId]`) محتوایی ندارد
    // به محض بارگذاری، کاربر را به صفحه‌ی چت همان workspace هدایت کن
    if (params.workspaceid) {
      router.push(`/${params.workspaceid}/chat`)
    }
  }, [params.workspaceid, router])

  // در مدتی که ریدایرکت انجام می‌شود، یک لودینگ نمایش بده
  return <Loading />
}
