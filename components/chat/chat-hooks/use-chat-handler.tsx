"use client"

import { ChatbotUIContext } from "@/context/context"
import { getAssistantCollectionsByAssistantId } from "@/db/assistant-collections"
import { getAssistantFilesByAssistantId } from "@/db/assistant-files"
import { getAssistantToolsByAssistantId } from "@/db/assistant-tools"
import { updateChat } from "@/db/chats"
import { getCollectionFilesByCollectionId } from "@/db/collection-files"
import { deleteMessagesIncludingAndAfter } from "@/db/messages"
import { buildFinalMessages } from "@/lib/build-prompt"
import { Tables } from "@/supabase/types"
import { ChatMessage, ChatPayload, LLMID, ModelProvider } from "@/types"
import { useRouter } from "next/navigation"
import { useContext, useEffect, useRef } from "react"
import { toast } from "sonner"
import { LLM_LIST } from "../../../lib/models/llm/llm-list"
import {
  createTempMessages,
  handleCreateChat,
  handleCreateMessages,
  handleHostedChat,
  handleLocalChat,
  handleRetrieval,
  processResponse,
  validateChatSettings
} from "../chat-helpers"

// ✨ ================= توابع کمکی (Helpers) ================= ✨

/**
 * وضعیت‌های مختلف چت را به حالت اولیه بازمی‌گرداند.
 */
const resetChatState = (context: any) => {
  context.setUserInput("")
  context.setChatMessages([])
  context.setSelectedChat(null)
  context.setChatFileItems([])
  context.setIsGenerating(false)
  context.setFirstTokenReceived(false)
  context.setChatFiles([])
  context.setChatImages([])
  context.setNewMessageFiles([])
  context.setNewMessageImages([])
  context.setShowFilesDisplay(false)
  context.setIsPromptPickerOpen(false)
  context.setIsFilePickerOpen(false)
  context.setSelectedTools([])
  context.setToolInUse("none")
}

/**
 * داده‌های یک دستیار (فایل‌ها، ابزارها و غیره) را به صورت موازی بارگذاری می‌کند.
 */
const loadAssistantData = async (
  assistant: Tables<"assistants">,
  context: any
) => {
  context.setChatSettings({
    model: assistant.model as LLMID,
    prompt: assistant.prompt,
    temperature: assistant.temperature,
    contextLength: assistant.context_length,
    includeProfileContext: assistant.include_profile_context,
    includeWorkspaceInstructions: assistant.include_workspace_instructions,
    embeddingsProvider: assistant.embeddings_provider as "openai" | "local"
  })

  const [assistantFiles, assistantCollections, assistantTools] =
    await Promise.all([
      getAssistantFilesByAssistantId(assistant.id),
      getAssistantCollectionsByAssistantId(assistant.id),
      getAssistantToolsByAssistantId(assistant.id)
    ])

  // ✨ FIX: Create a consistent array of partial file objects from the start
  type PartialFile = { id: string; name: string; type: string }

  let allFiles: PartialFile[] = assistantFiles.files.map(file => ({
    id: file.id,
    name: file.name,
    type: file.type
  }))

  const collectionFilePromises = assistantCollections.collections.map(
    collection => getCollectionFilesByCollectionId(collection.id)
  )
  const collectionsFiles = await Promise.all(collectionFilePromises)
  for (const collectionFile of collectionsFiles) {
    // These files are already the correct partial type
    allFiles.push(...collectionFile.files)
  }

  context.setSelectedTools(assistantTools.tools)
  context.setChatFiles(
    allFiles.map(file => ({
      id: file.id,
      name: file.name,
      type: file.type,
      file: null
    }))
  )

  if (allFiles.length > 0) {
    context.setShowFilesDisplay(true)
  }
}

// ✨ ================= هوک اصلی (Main Hook) ================= ✨

export const useChatHandler = () => {
  const router = useRouter()
  const context = useContext(ChatbotUIContext)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (
      !context.isPromptPickerOpen &&
      !context.isFilePickerOpen &&
      !context.isToolPickerOpen
    ) {
      chatInputRef.current?.focus()
    }
  }, [
    context.isPromptPickerOpen,
    context.isFilePickerOpen,
    context.isToolPickerOpen
  ])

  const handleNewChat = async () => {
    if (!context.selectedWorkspace) return

    resetChatState(context)

    if (context.selectedAssistant) {
      await loadAssistantData(context.selectedAssistant, context)
    } else if (context.selectedPreset) {
      context.setChatSettings({
        model: context.selectedPreset.model as LLMID,
        prompt: context.selectedPreset.prompt,
        temperature: context.selectedPreset.temperature,
        contextLength: context.selectedPreset.context_length,
        includeProfileContext: context.selectedPreset.include_profile_context,
        includeWorkspaceInstructions:
          context.selectedPreset.include_workspace_instructions,
        embeddingsProvider: context.selectedPreset.embeddings_provider as
          | "openai"
          | "local"
      })
    }

    return router.push(`/${context.selectedWorkspace.id}/chat`)
  }

  const handleFocusChatInput = () => {
    chatInputRef.current?.focus()
  }

  const handleStopMessage = () => {
    if (context.abortController) {
      context.abortController.abort()
    }
  }

  const handleSendMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    const startingInput = messageContent
    let currentChat = context.selectedChat ? { ...context.selectedChat } : null

    try {
      context.setUserInput("")
      context.setIsGenerating(true)
      context.setNewMessageImages([])
      const newAbortController = new AbortController()
      context.setAbortController(newAbortController)

      const modelData = [
        ...context.models.map(model => ({
          modelId: model.model_id as LLMID,
          modelName: model.name,
          provider: "custom" as ModelProvider,
          hostedId: model.id,
          platformLink: "",
          imageInput: false
        })),
        ...LLM_LIST,
        ...context.availableLocalModels,
        ...context.availableOpenRouterModels
      ].find(llm => llm.modelId === context.chatSettings?.model)

      validateChatSettings(
        context.chatSettings,
        modelData,
        context.profile,
        context.selectedWorkspace,
        messageContent
      )

      let retrievedFileItems: Tables<"file_items">[] = []
      if (
        (context.newMessageFiles.length > 0 || context.chatFiles.length > 0) &&
        context.useRetrieval
      ) {
        context.setToolInUse("retrieval")
        retrievedFileItems = await handleRetrieval(
          context.userInput,
          context.newMessageFiles,
          context.chatFiles,
          context.chatSettings!.embeddingsProvider,
          context.sourceCount
        )
      }

      const { tempUserChatMessage, tempAssistantChatMessage } =
        createTempMessages(
          messageContent,
          chatMessages,
          context.chatSettings!,
          context.newMessageImages.map(img => img.base64),
          isRegeneration,
          context.setChatMessages,
          context.selectedAssistant
        )

      const payload: ChatPayload = {
        chatSettings: context.chatSettings!,
        workspaceInstructions: context.selectedWorkspace!.instructions || "",
        chatMessages: isRegeneration
          ? [...chatMessages]
          : [...chatMessages, tempUserChatMessage],
        assistant: context.selectedAssistant,
        messageFileItems: retrievedFileItems,
        chatFileItems: context.chatFileItems
      }

      let generatedText = ""
      // This can be further refactored into a single function
      if (payload.chatSettings.model === "dall-e-3") {
        // ... (DALL-E logic)
      } else if (context.selectedTools.length > 0) {
        generatedText = await processResponse(
          await fetch("/api/chat", {
            method: "POST",
            body: JSON.stringify({
              chatSettings: payload.chatSettings,
              messages: await buildFinalMessages(
                payload,
                context.profile!,
                context.chatImages
              ),
              enableWebSearch: Boolean(context.chatSettings?.enableWebSearch)
            })
          }),
          isRegeneration
            ? payload.chatMessages[payload.chatMessages.length - 1]
            : tempAssistantChatMessage,
          true,
          newAbortController,
          context.setFirstTokenReceived,
          context.setChatMessages,
          context.setToolInUse
        )
      } else if (modelData!.provider === "ollama") {
        generatedText = await handleLocalChat(
          payload,
          context.profile!,
          context.chatSettings!,
          tempAssistantChatMessage,
          isRegeneration,
          newAbortController,
          context.setIsGenerating,
          context.setFirstTokenReceived,
          context.setChatMessages,
          context.setToolInUse
        )
      } else {
        generatedText = await handleHostedChat(
          payload,
          context.profile!,
          modelData!,
          tempAssistantChatMessage,
          isRegeneration,
          newAbortController,
          context.newMessageImages,
          context.chatImages,
          context.setIsGenerating,
          context.setFirstTokenReceived,
          context.setChatMessages,
          context.setToolInUse
        )
      }

      if (!currentChat) {
        currentChat = await handleCreateChat(
          context.chatSettings!,
          context.profile!,
          context.selectedWorkspace!,
          messageContent,
          context.selectedAssistant!,
          context.newMessageFiles,
          context.setSelectedChat,
          context.setChats,
          context.setChatFiles
        )
      } else {
        const updatedChat = await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })
        context.setChats((prev: any) =>
          prev.map((c: any) => (c.id === updatedChat.id ? updatedChat : c))
        )
      }

      await handleCreateMessages(
        chatMessages,
        currentChat,
        context.profile!,
        modelData!,
        messageContent,
        generatedText,
        context.newMessageImages,
        isRegeneration,
        retrievedFileItems,
        context.setChatMessages,
        context.setChatFileItems,
        context.setChatImages,
        context.selectedAssistant
      )

      context.setIsGenerating(false)
      context.setFirstTokenReceived(false)
    } catch (error: any) {
      context.setIsGenerating(false)
      context.setFirstTokenReceived(false)
      context.setUserInput(startingInput)
      toast.error(error.message || "An unexpected error occurred.")
    }
  }

  const handleSendEdit = async (
    editedContent: string,
    sequenceNumber: number
  ) => {
    if (!context.selectedChat) return

    await deleteMessagesIncludingAndAfter(
      context.selectedChat.user_id,
      context.selectedChat.id,
      sequenceNumber
    )

    const filteredMessages = context.chatMessages.filter(
      (chatMessage: ChatMessage) =>
        chatMessage.message.sequence_number < sequenceNumber
    )

    context.setChatMessages(filteredMessages)
    handleSendMessage(editedContent, filteredMessages, false)
  }

  return {
    chatInputRef,
    handleNewChat,
    handleSendMessage,
    handleFocusChatInput,
    handleStopMessage,
    handleSendEdit
  }
}
