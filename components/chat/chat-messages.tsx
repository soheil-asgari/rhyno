import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import { FC, useContext, useState } from "react"
import { Message } from "../messages/message"

import "./ChatMessages.css" // فرض می‌کنیم که فایل CSS خارجی در این مسیر قرار دارد.

interface ChatMessagesProps {}

export const ChatMessages: FC<ChatMessagesProps> = ({}) => {
  const { chatMessages, chatFileItems } = useContext(ChatbotUIContext)

  const { handleSendEdit } = useChatHandler()

  const [editingMessage, setEditingMessage] = useState<Tables<"messages">>()

  return chatMessages
    .sort((a, b) => a.message.sequence_number - b.message.sequence_number)
    .map((chatMessage, index, array) => {
      const messageFileItems = chatFileItems.filter(
        (chatFileItem, _, self) =>
          chatMessage.fileItems.includes(chatFileItem.id) &&
          self.findIndex(item => item.id === chatFileItem.id) === _
      )

      // استفاده از image_paths به جای imageUrl
      const imagePaths = chatMessage.message.image_paths

      return (
        <div key={chatMessage.message.sequence_number}>
          <Message
            message={chatMessage.message}
            fileItems={messageFileItems}
            isEditing={editingMessage?.id === chatMessage.message.id}
            isLast={index === array.length - 1}
            onStartEdit={setEditingMessage}
            onCancelEdit={() => setEditingMessage(undefined)}
            onSubmitEdit={handleSendEdit}
          />

          {/* اگر تصویر در پیام باشد، آن را نمایش دهیم */}
          {imagePaths && imagePaths.length > 0 && (
            <div className="message-image-container">
              {imagePaths.map((imagePath, index) => (
                <img
                  key={index}
                  src={imagePath} // اگر تصاویر Base64 است، از URL مناسب یا Base64 استفاده کنید
                  alt="Generated Image"
                  className="message-image"
                />
              ))}
            </div>
          )}
        </div>
      )
    })
}
