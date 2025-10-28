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
import { FC, useContext, useEffect, useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { useScroll } from "./chat-hooks/use-scroll"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { ChatScrollButtons } from "./chat-scroll-buttons"
import useDynamicVh from "@/lib/hooks/use-dynamic-vh"
import { RhynoAutoUI } from "@/components/RhynoAutoUI"

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

    if (
      selectedChat &&
      selectedChat.id === params.chatid &&
      chatMessages.length > 0
    ) {
      setLoading(false)
      return
    }

    fetchData().then(() => {
      // if (window.innerWidth > 768) {
      //   handleFocusChatInput()
      // }
    })
  }, [params.chatid, selectedChat, chatMessages])

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

  const memoizedChatMessages = useMemo(() => {
    return <ChatMessages />
  }, [chatMessages])

  const memoizedChatInput = useMemo(() => <ChatInput />, [])
  if (loading) {
    return <Loading />
  }

  return (
    <div className="relative flex min-h-[calc(var(--vh,1vh)*100)] flex-col items-center">
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

      {/* 👇 ==== اصلاح شماره ۱: کلاس 'flex-1' از اینجا حذف شد ==== 👇 */}
      <div
        className="flex w-full flex-col border-b" // 'flex-1' حذف شد
        onScroll={handleScroll}
      >
        <div ref={messagesStartRef} />

        {memoizedChatMessages}

        <div ref={messagesEndRef} />
      </div>

      {/* 👇 ==== اصلاح شماره ۲: فاصله‌انداز (Spacer) اضافه شد ==== 👇 */}
      {/* این المان، فضای خالی بین پیام‌ها و کادر ورودی را پر می‌کند */}
      <div className="flex-1" />

      {/* کادر ورودی */}
      <div className="flex w-full grow-0 flex-col justify-end px-2 pb-3 sm:w-[600px] md:w-[700px] lg:w-[700px] xl:w-[800px]">
        {isRealtimeMode ? (
          <VoiceUI chatSettings={context.chatSettings} />
        ) : (
          memoizedChatInput
        )}
      </div>
      <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div>
    </div>
  )
}
