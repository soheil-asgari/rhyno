"use aclient"

import Loading from "@/app/[locale]/loading"
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
import { LLMID, MessageImage, ChatMessage } from "@/types" // ✨ ChatMessage اضافه شد
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

interface ChatUIProps {}

export const ChatUI: FC<ChatUIProps> = ({}) => {
  const params = useParams()
  const context = useContext(ChatbotUIContext)

  // ✨ FIX 1: Move useChatHandler hook to the top
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

  const fetchAllChatData = async (chatId: string) => {
    const [chat, messages, chatFilesResponse] = await Promise.all([
      getChatById(chatId),
      getMessagesByChatId(chatId),
      getChatFilesByChatId(chatId)
    ])

    if (!chat) return

    await processMessagesAndFiles(messages, chatFilesResponse.files)
    await processChatDetails(chat)
  }

  const processMessagesAndFiles = async (
    messages: Tables<"messages">[],
    chatFiles: Tables<"files">[]
  ) => {
    if (messages.length === 0) {
      context.setChatMessages([])
      return
    }

    const imagePromises = messages.flatMap(msg =>
      (msg.image_paths || []).map(async path => {
        const url = await getMessageImageFromStorage(path)
        if (!url)
          return { messageId: msg.id, path, base64: "", url, file: null }
        const response = await fetch(url)
        const blob = await response.blob()
        const base64 = await convertBlobToBase64(blob)
        return { messageId: msg.id, path, base64, url, file: null }
      })
    )

    // ✨ FIX 2: Correctly map file items to messages using their index
    const fileItemPromises = messages.map(msg =>
      getMessageFileItemsByMessageId(msg.id)
    )

    const [messageFileItemsResults, images] = await Promise.all([
      Promise.all(fileItemPromises),
      Promise.all(imagePromises)
    ])

    const allFileItems = messageFileItemsResults.flatMap(
      result => result.file_items
    )
    context.setChatFileItems(allFileItems)

    const newChatMessages: ChatMessage[] = messages.map((message, index) => {
      const fileItemsForThisMessage = messageFileItemsResults[index].file_items
      return {
        message,
        fileItems: fileItemsForThisMessage.map(fi => fi.id)
      }
    })

    context.setChatMessages(newChatMessages)
    context.setChatImages(images)
    context.setChatFiles(
      chatFiles.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        file: null
      }))
    )

    if (chatFiles.length > 0) {
      context.setUseRetrieval(true)
      context.setShowFilesDisplay(true)
    }
  }

  const processChatDetails = async (chat: Tables<"chats">) => {
    context.setSelectedChat(chat)

    if (chat.assistant_id) {
      const assistant = context.assistants.find(a => a.id === chat.assistant_id)
      if (assistant) {
        context.setSelectedAssistant(assistant)
        const assistantTools = await getAssistantToolsByAssistantId(
          assistant.id
        )
        context.setSelectedTools(assistantTools.tools)
      }
    }

    context.setChatSettings({
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
        <ChatInput />
      </div>

      <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
        <ChatHelp />
      </div>
    </div>
  )
}
