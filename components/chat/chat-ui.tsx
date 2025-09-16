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
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatScrollButtons } from "./chat-scroll-buttons"
import useDynamicVh from "@/lib/hooks/use-dynamic-vh"

const ChatHelp = dynamic(() => import("./chat-help").then(mod => mod.ChatHelp))
const ChatSecondaryButtons = dynamic(() =>
  import("./chat-secondary-buttons").then(mod => mod.ChatSecondaryButtons)
)
const VoiceUI = dynamic(() => import("./voice-ui").then(mod => mod.VoiceUI))

interface ChatUIProps {
  isRealtimeMode: boolean
}

export const ChatUI: FC<ChatUIProps> = ({ isRealtimeMode }) => {
  useDynamicVh()
  const params = useParams()
  const context = useContext(ChatbotUIContext)
  const {
    // 👇 ==== اصلاح شماره ۱: chatMessages را اینجا اضافه کنید ==== 👇
    chatMessages,
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

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await fetchMessages()
      await fetchChat()
      scrollToBottom()
      setIsAtBottom(true)
      setLoading(false)
    }

    if (!params.chatid) {
      setLoading(false)
      return
    }

    // 👇 ==== اصلاح شماره ۲: اینجا از chatMessages استفاده کنید ==== 👇
    if (
      selectedChat &&
      selectedChat.id === params.chatid &&
      chatMessages.length > 0
    ) {
      setLoading(false)
      return
    }

    fetchData().then(() => {
      handleFocusChatInput()
    })
  }, [params.chatid, selectedChat])

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
    // 👇 مرحله ۱: این div اصلی، کل لایوت را به عنوان یک لایه تمام‌صفحه و مستقل کنترل می‌کند
    <div
      className="fixed inset-0 flex flex-col bg-[#111827]"
      style={{ height: "var(--app-height)" }}
    >
      {/* دکمه‌های absolute مثل قبل باقی می‌مانند */}
      <div className="absolute left-4 top-2.5 z-10 flex justify-center">
        <ChatScrollButtons
          isAtTop={isAtTop}
          isAtBottom={isAtBottom}
          isOverflowing={isOverflowing}
          scrollToTop={scrollToTop}
          scrollToBottom={scrollToBottom}
        />
      </div>
      <div className="absolute right-4 top-1 z-10 flex h-[40px] items-center space-x-2">
        <ChatSecondaryButtons />
      </div>

      {/* 👇 مرحله ۲: هدر با ارتفاع ثابت و غیرقابل تغییر */}
      <div className="bg-secondary flex max-h-[50px] min-h-[50px] w-full shrink-0 items-center justify-center border-b-2 font-bold">
        <div className="max-w-[200px] truncate sm:max-w-[400px] md:max-w-[500px] lg:max-w-[600px] xl:max-w-[700px]">
          {context.selectedChat?.name || "Chat"}
        </div>
      </div>

      {/* 👇 مرحله ۳: لیست پیام‌ها که تمام فضای باقی‌مانده را پر کرده و فقط خودش اسکرول می‌خورد */}
      <div className="w-full flex-1 overflow-y-auto" onScroll={handleScroll}>
        <div ref={messagesStartRef} />
        <ChatMessages />
        <div ref={messagesEndRef} />
      </div>

      {/* 👇 مرحله ۴: بخش ورود متن با ارتفاع ثابت و غیرقابل تغییر */}
      <div className="relative w-full max-w-4xl shrink-0 items-end px-2 pb-3 pt-2 sm:pb-8 sm:pt-5">
        {isRealtimeMode ? (
          <VoiceUI chatSettings={context.chatSettings} />
        ) : (
          <ChatInput />
        )}
      </div>

      {/* دکمه ChatHelp هم به صورت absolute باقی می‌ماند */}
      <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div>
    </div>
  )
}
