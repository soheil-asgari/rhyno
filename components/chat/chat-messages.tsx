"use client" // ✨ اطمینان از اینکه این خط وجود دارد

import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { FC, useContext, useState } from "react"
import { Message } from "../messages/message"
import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import Image from "next/image" // ✨ ایمپورت کامپوننت Image

interface ChatMessagesProps {}

export const ChatMessages: FC<ChatMessagesProps> = ({}) => {
  // ✨ ۱. پروفایل کاربر را از کانتکست دریافت کنید
  const { chatMessages, chatFileItems, profile } = useContext(ChatbotUIContext)
  const { handleSendEdit } = useChatHandler()
  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>()

  // ✨ ۲. شرط برای نمایش صفحه خوش‌آمدگویی
  if (chatMessages.length === 0) {
    const userName = profile?.display_name || profile?.username || "کاربر"
    return (
      <div
        dir="rtl"
        className="flex h-full flex-col items-center justify-center text-center"
      >
        <div className="font-vazir text-3xl font-bold text-gray-200">
          سلام {userName} 👋
        </div>
        <div className="font-vazir mt-2 text-lg text-gray-400">
          چطور می‌توانم کمکتان کنم؟
        </div>
      </div>
    )
  }

  // ✨ ۳. اگر پیامی وجود داشت، کد قبلی شما اجرا می‌شود
  const sortedChatMessages = [...chatMessages].sort(
    (a, b) => a.message.sequence_number - b.message.sequence_number
  )

  return (
    <>
      {sortedChatMessages.map((chatMessage, index, array) => {
        const messageFileItems = chatFileItems.filter(
          (chatFileItem, _, self) =>
            chatMessage.fileItems.includes(chatFileItem.id) &&
            self.findIndex(item => item.id === chatFileItem.id) === _
        )

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
