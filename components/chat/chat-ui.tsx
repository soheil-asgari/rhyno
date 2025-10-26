"use client"

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
import { LLMID, ChatMessage, MessageImage } from "@/types"
import { Tables } from "@/supabase/types"
import { useParams } from "next/navigation"
import { FC, useContext, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useScroll } from "./chat-hooks/use-scroll"
// ❌ ChatInput دیگر اینجا import نمی‌شود (چون در ChatPage است)
// import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatScrollButtons } from "./chat-scroll-buttons"
import useDynamicVh from "@/lib/hooks/use-dynamic-vh"
import { RhynoAutoUI } from "@/components/RhynoAutoUI"

const ChatHelp = dynamic(() => import("./chat-help").then(mod => mod.ChatHelp))
const ChatSecondaryButtons = dynamic(() =>
  import("./chat-secondary-buttons").then(mod => mod.ChatSecondaryButtons)
)
// ❌ VoiceUI دیگر اینجا import نمی‌شود
// const VoiceUI = dynamic(() => import("./voice-ui").then(mod => mod.VoiceUI))

interface ChatUIProps {
  isRealtimeMode: boolean
}

export const ChatUI: FC<ChatUIProps> = ({ isRealtimeMode }) => {
  useDynamicVh()
  const params = useParams()
  const context = useContext(ChatbotUIContext)
  const {
    chatMessages, // اطمینان حاصل کنید که chatMessages از context گرفته می‌شود
    setChatMessages,
    selectedChat,
    setSelectedChat,
    setChatSettings,
    setChatImages,
    assistants,
    setSelectedAssistant,
    setChatFileItems,
    setChatFiles,
    setShowFilesDisplay,
    setUseRetrieval,
    setSelectedTools
  } = useContext(ChatbotUIContext)

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

  // 👇 ==== اصلاح شماره ۱ (رفع فلش):
  // اگر chatid وجود دارد، لودینگ true است، اگر نه (چت جدید)، false است.
  const [loading, setLoading] = useState(!!params.chatid)

  useEffect(() => {
    const fetchData = async () => {
      // setLoading(true) // دیگر لازم نیست اینجا باشد
      await fetchMessages()
      await fetchChat()
      scrollToBottom()
      setIsAtBottom(true)
      setLoading(false)
    }

    if (!params.chatid) {
      // setLoading(false) // دیگر لازم نیست، چون useState این کار را کرد
      return
    }

    if (
      selectedChat &&
      selectedChat.id === params.chatid &&
      chatMessages.length > 0
    ) {
      // setLoading(false) // دیگر لازم نیست
      return
    }

    fetchData().then(() => {
      handleFocusChatInput()
    })
  }, [params.chatid, selectedChat]) // وابستگی‌ها درست هستند

  const fetchMessages = async () => {
    const fetchedMessages = await getMessagesByChatId(params.chatid as string)

    const imagePromises: Promise<MessageImage>[] = fetchedMessages.flatMap(
      message =>
        message.image_paths
          ? message.image_paths.map(async imagePath => {
              const url = await getMessageImageFromStorage(imagePath)
              if (url) {
                const response = await fetch(url)
                const blob = await response.blob()
                const base64 = await convertBlobToBase64(blob)
                return {
                  messageId: message.id,
                  path: imagePath,
                  base64,
                  url,
                  file: null
                }
              }
              return {
                messageId: message.id,
                path: imagePath,
                base64: "",
                url,
                file: null
              }
            })
          : []
    )
    const images: MessageImage[] = await Promise.all(imagePromises.flat())
    setChatImages(images)

    const messageFileItemPromises = fetchedMessages.map(
      async message => await getMessageFileItemsByMessageId(message.id)
    )
    const messageFileItems = await Promise.all(messageFileItemPromises)
    const uniqueFileItems = messageFileItems.flatMap(item => item.file_items)
    setChatFileItems(uniqueFileItems)
    const chatFiles = await getChatFilesByChatId(params.chatid as string)
    setChatFiles(
      chatFiles.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        file: null
      }))
    )
    setUseRetrieval(true)
    setShowFilesDisplay(true)
    const fetchedChatMessages = fetchedMessages.map(message => {
      return {
        message,
        fileItems: messageFileItems
          .filter(messageFileItem => messageFileItem.id === message.id)
          .flatMap(messageFileItem =>
            messageFileItem.file_items.map(fileItem => fileItem.id)
          )
      }
    })
    setChatMessages(fetchedChatMessages)
  }

  const fetchChat = async () => {
    const chat = await getChatById(params.chatid as string)
    if (!chat) return
    if (chat.assistant_id) {
      const assistant = assistants.find(
        assistant => assistant.id === chat.assistant_id
      )
      if (assistant) {
        setSelectedAssistant(assistant)
        const assistantTools = (
          await getAssistantToolsByAssistantId(assistant.id)
        ).tools
        setSelectedTools(assistantTools)
      }
    }
    setSelectedChat(chat)
    setChatSettings({
      model: chat.model as LLMID,
      prompt: chat.prompt,
      temperature: chat.temperature,
      contextLength: chat.context_length,
      includeProfileContext: chat.include_profile_context,
      includeWorkspaceInstructions: chat.include_workspace_instructions,
      embeddingsProvider: chat.embeddings_provider as "openai" | "local"
    })
  }

  if (loading) {
    return <Loading />
  }

  return (
    // 👇 ==== اصلاح شماره ۲ (رفع Layout):
    // h-[calc(var(--vh,1vh)*100)] (ارتفاع ۱۰۰٪ صفحه)
    // به size-full (ارتفاع و عرض ۱۰۰٪ والد) تغییر کرد.
    <div className="relative flex size-full flex-col items-center">
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
        className="flex w-full flex-1 flex-col overflow-auto border-b"
        onScroll={handleScroll}
      >
        <div ref={messagesStartRef} />
        <ChatMessages />
        <div ref={messagesEndRef} />
      </div>

      {/* 👇 این بخش‌ها کامنت شده باقی می‌مانند، 
        چون ChatPage اکنون مسئول نمایش آنهاست.
      */}
      {/* <div className="relative w-full max-w-4xl items-end px-2 pb-3 pt-0 sm:pb-8 sm:pt-5">
        {isRealtimeMode ? (
          <VoiceUI chatSettings={context.chatSettings} />
        ) : (
          <ChatInput />
        )}
      </div> */}
      {/* <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div> */}
    </div>
  )
}
