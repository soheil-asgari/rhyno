"use client"

import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
// 👇 ۱. useMemo و useContext را import کنید
import { FC, useContext, useMemo, useState } from "react"
import { Message } from "../messages/message"
import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"

interface ChatMessagesProps {}

export const ChatMessages: FC<ChatMessagesProps> = ({}) => {
  const { chatMessages, chatFileItems } = useContext(ChatbotUIContext)
  const { handleSendEdit } = useChatHandler()
  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>()

  // 👇 ۲. آرایه‌ی مرتب‌شده را با useMemo بسازید
  // این تابع فقط زمانی اجرا می‌شود که chatMessages تغییر کند
  const sortedChatMessages = useMemo(() => {
    return [...chatMessages].sort(
      (a, b) => a.message.sequence_number - b.message.sequence_number
    )
  }, [chatMessages])

  // 👇 ۳. یک نقشه (Map) از فایل‌ها برای جستجوی سریع بسازید
  // این نقشه فقط زمانی بازسازی می‌شود که chatFileItems تغییر کند
  const fileItemMap = useMemo(() => {
    return new Map(chatFileItems.map(item => [item.id, item]))
  }, [chatFileItems])

  // اگر پیامی وجود نداشت، چیزی رندر نکن
  if (sortedChatMessages.length === 0) {
    return null
  }

  return (
    <>
      {sortedChatMessages.map((chatMessage, index, array) => {
        // 👇 ۴. پیدا کردن فایل‌ها با استفاده از نقشه (بسیار سریع‌تر)
        const messageFileItems = chatMessage.fileItems
          .map(id => fileItemMap.get(id))
          .filter(Boolean) as Tables<"file_items">[] // filter(Boolean) موارد undefined را حذف می‌کند

        return (
          <Message
            key={chatMessage.message.id}
            message={chatMessage.message}
            fileItems={messageFileItems}
            isEditing={editingMessage?.id === chatMessage.message.id}
            isLast={index === array.length - 1}
            onStartEdit={setEditingMessage}
            onCancelEdit={() => setEditingMessage(undefined)}
            onSubmitEdit={handleSendEdit}
          />
        )
      })}
    </>
  )
}
