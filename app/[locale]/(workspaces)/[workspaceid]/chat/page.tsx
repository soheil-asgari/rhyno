"use client"

import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { useTheme } from "next-themes"
import { useContext } from "react"
import dynamic from "next/dynamic"

// کامپوننت‌های سنگین به صورت دینامیک
const ChatHelp = dynamic(() =>
  import("@/components/chat/chat-help").then(mod => mod.ChatHelp)
)
const ChatInput = dynamic(() =>
  import("@/components/chat/chat-input").then(mod => mod.ChatInput)
)
const ChatSettings = dynamic(() =>
  import("@/components/chat/chat-settings").then(mod => mod.ChatSettings)
)
const ChatUI = dynamic(() =>
  import("@/components/chat/chat-ui").then(mod => mod.ChatUI)
)
const QuickSettings = dynamic(() =>
  import("@/components/chat/quick-settings").then(mod => mod.QuickSettings)
)
const Brand = dynamic(() =>
  import("@/components/ui/brand").then(mod => mod.Brand)
)
// ✨ ۱. کامپوننت جدید VoiceUI را به صورت دینامیک وارد کنید
const VoiceUI = dynamic(() =>
  import("@/components/chat/voice-ui").then(mod => mod.VoiceUI)
)

export default function ChatPage() {
  useHotkey("o", () => handleNewChat())
  useHotkey("l", () => {
    handleFocusChatInput()
  })

  // ✨ ۲. chatSettings را از context بگیرید
  const { chatMessages, chatSettings } = useContext(ChatbotUIContext)
  const { handleNewChat, handleFocusChatInput } = useChatHandler()
  const { theme } = useTheme()

  // ✨ ۳. یک متغیر برای تشخیص حالت realtime بسازید
  const isRealtimeMode = chatSettings?.model.includes("realtime") ?? false

  return (
    <>
      {chatMessages.length === 0 ? (
        // حالت نمایش صفحه خالی (اولین ورود)
        <div className="relative flex h-full flex-col items-center justify-center">
          <div className="top-50% left-50% -translate-x-50% -translate-y-50% absolute mb-20">
            <Brand theme={theme === "dark" ? "dark" : "light"} />
          </div>

          <div className="absolute left-2 top-2">
            <QuickSettings />
          </div>

          <div className="absolute right-2 top-2">
            <ChatSettings />
          </div>

          <div className="flex grow flex-col items-center justify-center" />

          <div className="w-full min-w-[300px] items-end px-2 pb-3 pt-0 sm:w-[600px] sm:pb-8 sm:pt-5 md:w-[700px] lg:w-[700px] xl:w-[800px]">
            {/* ✨ ۴. رندر شرطی بین VoiceUI و ChatInput */}
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
        // حالت نمایش صفحه چت فعال
        // ✨ ۵. isRealtimeMode را به ChatUI پاس دهید
        <ChatUI isRealtimeMode={isRealtimeMode} />
      )}
    </>
  )
}
