"use client"
"use strict"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { useEffect, useContext } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { MODEL_PROMPTS } from "@/lib/build-prompt"
import toast, { Toaster } from "react-hot-toast"

const ChatHelp = dynamic(() =>
  import("@/components/chat/chat-help").then(mod => mod.ChatHelp)
)
const ChatInput = dynamic(() =>
  import("@/components/chat/chat-input").then(mod => mod.ChatInput)
)
const ChatSettings = dynamic(() =>
  import("@/components/chat/chat-settings").then(mod => mod.ChatSettings)
)
const ChatUI = dynamic(
  () => import("@/components/chat/chat-ui").then(mod => mod.ChatUI),
  { ssr: false }
)
const QuickSettings = dynamic(() =>
  import("@/components/chat/quick-settings").then(mod => mod.QuickSettings)
)
// Brand دیگر لازم نیست
// const Brand = dynamic(() =>
//   import("@/components/ui/brand").then(mod => mod.Brand)
// )
const VoiceUI = dynamic(
  () => import("@/components/chat/voice-ui").then(mod => mod.VoiceUI),
  { ssr: false }
)

export default function ChatPage({
  params
}: {
  params: { workspaceId: string }
}) {
  const { theme } = useTheme()
  const searchParams = useSearchParams()
  const router = useRouter()
  const welcome = searchParams.get("welcome")

  // ✨ ۱. پروفایل کاربر را از کانتکست بگیرید
  const { chatSettings, setChatSettings, chatMessages, profile } =
    useContext(ChatbotUIContext)

  // 🔹 نمایش Toast خوش‌آمدگویی (بدون تغییر)
  useEffect(() => {
    if (welcome === "true") {
      toast.success("🎉 ۱$ خوش‌آمدگویی به کیف پول شما اضافه شد!")
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete("welcome")
      router.replace(newUrl.toString())
    }
  }, [welcome, router])

  // 🔹 تنظیم prompt مدل (بدون تغییر)
  useEffect(() => {
    if (!chatSettings) return
    setChatSettings(prev => ({
      ...prev,
      prompt: MODEL_PROMPTS[prev.model] || "You are a helpful AI assistant."
    }))
  }, [chatSettings?.model, setChatSettings])

  // ✨ ۲. نام کاربر را استخراج کنید
  const userName = profile?.display_name || profile?.username || "کاربر"

  const isRealtimeMode = chatSettings?.model?.includes("realtime") ?? false

  return (
    <>
      <Toaster position="top-right" />
      {chatMessages.length === 0 ? (
        <div className="relative flex size-full flex-col items-center justify-center">
          <div className="mb-20 flex size-full flex-col items-center justify-center">
            {/* ✨ ۳. کامپوننت Brand با پیام خوش‌آمدگویی جایگزین شد */}
            <div className="text-center" dir="rtl">
              <div className="font-vazir text-3xl font-bold text-gray-200">
                سلام {userName} 👋
              </div>
              <div className="font-vazir mt-2 text-lg text-gray-400">
                چطور می‌توانم کمکتان کنم؟
              </div>
            </div>
          </div>

          <div className="absolute left-2 top-2">
            <QuickSettings />
          </div>

          <div className="absolute right-2 top-2">
            <ChatSettings />
          </div>

          <div className="flex grow flex-col items-center justify-center" />

          <div className="w-full min-w-[300px] items-end px-2 pb-3 pt-0 sm:w-[600px] sm:pb-8 sm:pt-5 md:w-[700px] lg:w-[700px] xl:w-[800px]">
            {isRealtimeMode ? (
              <VoiceUI chatSettings={chatSettings} />
            ) : (
              <ChatInput />
            )}
          </div>

          <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
            <ChatHelp />
          </div>
        </div>
      ) : (
        <ChatUI isRealtimeMode={isRealtimeMode} />
      )}
    </>
  )
}
