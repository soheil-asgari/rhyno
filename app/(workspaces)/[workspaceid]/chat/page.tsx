"use client"

import { ChatbotUIContext } from "@/context/context"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { useEffect, useContext } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation" // usePathname اضافه شد
import { MODEL_PROMPTS } from "@/lib/build-prompt"
import toast, { Toaster } from "react-hot-toast"

// ✨ کامپوننت‌ها دیگر اینجا ایمپورت نمی‌شوند چون ChatUI خودش آن‌ها را مدیریت می‌کند
const ChatUI = dynamic(
  () => import("@/components/chat/chat-ui").then(mod => mod.ChatUI),
  { ssr: false }
)

export default function ChatPage() {
  // params دیگر لازم نیست
  const { chatSettings, setChatSettings } = useContext(ChatbotUIContext)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname() // برای پاک کردن URL

  // 🔹 نمایش Toast خوش‌آمدگویی (بدون تغییر)
  useEffect(() => {
    const welcome = searchParams.get("welcome")
    if (welcome === "true") {
      toast.success("🎉 ۱$ خوش‌آمدگویی به کیف پول شما اضافه شد!")
      // روشی مدرن‌تر برای پاک کردن پارامتر از URL بدون رفرش کامل
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, router, pathname])

  // 🔹 تنظیم prompt مدل (بدون تغییر)
  useEffect(() => {
    if (!chatSettings) return

    // این شرط از اجرای بی‌نهایت جلوگیری می‌کند
    if (
      chatSettings.prompt !==
      (MODEL_PROMPTS[chatSettings.model] || "You are a helpful AI assistant.")
    ) {
      setChatSettings(prev => ({
        ...prev,
        prompt: MODEL_PROMPTS[prev.model] || "You are a helpful AI assistant."
      }))
    }
  }, [chatSettings, setChatSettings])

  // ✨ تعیین isRealtimeMode در همینجا باقی می‌ماند
  const isRealtimeMode = chatSettings?.model?.includes("realtime") ?? false

  return (
    <>
      <Toaster position="top-right" />

      {/* ✅ ساختار اصلی و ساده شده:
        - دیگر شرط chatMessages.length === 0 وجود ندارد.
        - این کامپوننت همیشه ChatUI را رندر می‌کند.
        - مسئولیت نمایش صفحه خالی یا پیام‌ها با کامپوننت ChatMessages است که قبلاً اصلاح کردیم.
      */}
      <ChatUI isRealtimeMode={isRealtimeMode} />
    </>
  )
}
