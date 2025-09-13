import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { FC, useContext, useState } from "react"
import { Message } from "../messages/message"
import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"

interface ChatMessagesProps {}

export const ChatMessages: FC<ChatMessagesProps> = ({}) => {
  const { chatMessages, chatFileItems } = useContext(ChatbotUIContext)
  // console.log("1. MESSAGES TO DISPLAY:", chatMessages);
  const { handleSendEdit } = useChatHandler()
  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>()

  // یک کپی از آرایه chatMessages ایجاد کرده و سپس آن را مرتب‌سازی می‌کنیم
  // این کار از تغییر مستقیم state جلوگیری می‌کند
  const sortedChatMessages = [...chatMessages].sort(
    (a, b) => a.message.sequence_number - b.message.sequence_number
  )

  return sortedChatMessages.map((chatMessage, index, array) => {
    const messageFileItems = chatFileItems.filter(
      (chatFileItem, _, self) =>
        chatMessage.fileItems.includes(chatFileItem.id) &&
        self.findIndex(item => item.id === chatFileItem.id) === _
    )

    return (
      <Message
        // استفاده از ID پیام به عنوان key، انتخاب مطمئن‌تر و بهتری است
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
  })
}
