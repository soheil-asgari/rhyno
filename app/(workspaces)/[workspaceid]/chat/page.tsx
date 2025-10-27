"use client"
"use strict"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { useEffect, useContext, useMemo } from "react"
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

  const { chatSettings, setChatSettings, chatMessages, profile } =
    useContext(ChatbotUIContext)

  useEffect(() => {
    if (welcome === "true") {
      toast.success("🎉 ۱$ خوش‌آمدگویی به کیف پول شما اضافه شد!")
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete("welcome")
      router.replace(newUrl.toString())
    }
  }, [welcome, router])

  useEffect(() => {
    if (!chatSettings) return
    setChatSettings(prev => ({
      ...prev,
      prompt: MODEL_PROMPTS[prev.model] || "You are a helpful AI assistant."
    }))
  }, [chatSettings?.model, setChatSettings])

  const userName = profile?.display_name || profile?.username || "کاربر"
  const firstName = userName.split(" ")[0]
  const isRealtimeMode = chatSettings?.model?.includes("realtime") ?? false
  const memoizedWelcomeChatInput = useMemo(() => <ChatInput />, [])

  return (
    <>
      <Toaster position="top-right" />

      <div className="relative size-full">
        {/* خوش‌آمدگویی */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
            chatMessages.length > 0
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          }`}
        >
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center" dir="rtl">
              <div className="font-vazir text-3xl font-bold">
                سلام {firstName} 👋
              </div>
              <div className="font-vazir mt-2 text-lg"></div>
            </div>
          </div>

          {/* ✅ ۲. این div اکنون به پایین صفحه هل داده می‌شود */}
          {/* ✅ ۳. کلاس pb-24 به pb-3 و sm:pb-8 تغییر کرد */}
          <div className="w-full min-w-[300px] items-end px-2 pb-3 pt-0 sm:w-[600px] sm:pb-8 sm:pt-5 md:w-[700px] lg:w-[700px] xl:w-[800px]">
            {isRealtimeMode ? (
              <VoiceUI chatSettings={chatSettings} />
            ) : (
              memoizedWelcomeChatInput
            )}
          </div>
          <div className="absolute right-2 top-2">
            <ChatSettings />
          </div>
          <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
            <ChatHelp />
          </div>
        </div>

        {/* Chat UI */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            chatMessages.length === 0
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          }`}
        >
          <ChatUI isRealtimeMode={isRealtimeMode} />
        </div>
      </div>
    </>
  )
}
