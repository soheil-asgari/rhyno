"use client" // ✨ ۱. اصلاح تایپو

import Loading from "@/app/loading"
import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { getChatFilesByChatId } from "@/db/chat-files"
import { getChatById } from "@/db/chats"
import { getMessageFileItemsByMessageId } from "@/db/message-file-items"
import { getMessagesByChatId } from "@/db/messages"
import { getMessageImageFromStorage } from "@/db/storage/message-images"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLMID, ChatMessage } from "@/types"
import { Tables } from "@/supabase/types"
import { useParams } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import dynamic from "next/dynamic"

import { useScroll } from "./chat-hooks/use-scroll"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatScrollButtons } from "./chat-scroll-buttons"

const ChatHelp = dynamic(() => import("./chat-help").then(mod => mod.ChatHelp))
const ChatSecondaryButtons = dynamic(() =>
  import("./chat-secondary-buttons").then(mod => mod.ChatSecondaryButtons)
)
// ✨ ۲. کامپوننت جدید VoiceUI را وارد کنید
const VoiceUI = dynamic(() => import("./voice-ui").then(mod => mod.VoiceUI))

// ✨ ۳. پراپرتی جدید را به اینترفیس اضافه کنید
interface ChatUIProps {
  isRealtimeMode: boolean
}

// ✨ ۴. پراپرتی جدید را در تعریف کامپوننت دریافت کنید
export const ChatUI: FC<ChatUIProps> = ({ isRealtimeMode }) => {
  const params = useParams()
  const context = useContext(ChatbotUIContext)

  const { handleNewChat, handleFocusChatInput } = useChatHandler()
  useHotkey("o", () => handleNewChat())

  const {
    messagesStartRef,
    messagesEndRef,
    handleScroll,
    scrollToBottom,
    setIsAtBottom,
    isAtTop,
    isAtBottom,
    isOverflowing,
    scrollToTop
  } = useScroll()

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.chatid) {
      setLoading(true)
      fetchAllChatData(params.chatid as string).then(() => {
        handleFocusChatInput()
        setLoading(false)
        scrollToBottom()
        setIsAtBottom(true)
      })
    } else {
      setLoading(false)
    }
  }, [params.chatid])

  // ... (تمام توابع fetchAllChatData, processMessagesAndFiles, processChatDetails بدون تغییر باقی می‌مانند)
  const fetchAllChatData = async (chatId: string) => {
    // ...
  }
  const processMessagesAndFiles = async (
    messages: Tables<"messages">[],
    chatFiles: Tables<"files">[]
  ) => {
    // ...
  }
  const processChatDetails = async (chat: Tables<"chats">) => {
    // ...
  }

  if (loading) {
    return <Loading />
  }

  return (
    <div className="relative flex h-full flex-col items-center">
      <div className="absolute left-4 top-2.5 flex justify-center">
        <ChatScrollButtons
          isAtTop={isAtTop}
          isAtBottom={isAtBottom}
          isOverflowing={isOverflowing}
          scrollToTop={scrollToTop}
          scrollToBottom={scrollToBottom}
        />
      </div>

      <div className="absolute right-4 top-1 flex h-[40px] items-center space-x-2">
        <ChatSecondaryButtons />
      </div>

      <div className="bg-secondary flex max-h-[50px] min-h-[50px] w-full items-center justify-center border-b-2 font-bold">
        <div className="max-w-[200px] truncate sm:max-w-[400px] md:max-w-[500px] lg:max-w-[600px] xl:max-w-[700px]">
          {context.selectedChat?.name || "Chat"}
        </div>
      </div>

      <div
        className="flex size-full flex-col overflow-auto border-b"
        onScroll={handleScroll}
      >
        <div ref={messagesStartRef} />
        <ChatMessages />
        <div ref={messagesEndRef} />
      </div>

      <div className="relative w-full min-w-[300px] items-end px-2 pb-3 pt-0 sm:w-[600px] sm:pb-8 sm:pt-5 md:w-[700px] lg:w-[700px] xl:w-[800px]">
        {/* ✨ ۵. رندر شرطی بین VoiceUI و ChatInput */}
        {isRealtimeMode ? (
          <VoiceUI chatSettings={context.chatSettings} />
        ) : (
          <ChatInput />
        )}
      </div>

      <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div>
    </div>
  )
}
