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
import { useRouter, usePathname } from "next/navigation"
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
import { supabase } from "@/lib/supabase/browser-client"
import { uploadMessageImage } from "@/db/storage/message-images"

export const useChatHandler = () => {
  const router = useRouter()
  const pathname = usePathname()

  const {
    userInput,
    chatFiles,
    setUserInput,
    setNewMessageImages,
    profile,
    setIsGenerating,
    setChatMessages,
    setFirstTokenReceived,
    selectedChat,
    selectedWorkspace,
    setSelectedChat,
    setChats,
    setSelectedTools,
    availableLocalModels,
    availableOpenRouterModels,
    abortController,
    setAbortController,
    chatSettings,
    newMessageImages,
    selectedAssistant,
    chatMessages,
    chatImages,
    setChatImages,
    setChatFiles,
    setNewMessageFiles,
    setShowFilesDisplay,
    newMessageFiles,
    chatFileItems,
    setChatFileItems,
    setToolInUse,
    useRetrieval,
    sourceCount,
    setIsPromptPickerOpen,
    setIsFilePickerOpen,
    selectedTools,
    selectedPreset,
    setChatSettings,
    models,
    isPromptPickerOpen,
    isFilePickerOpen,
    isToolPickerOpen
  } = useContext(ChatbotUIContext)

  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isPromptPickerOpen || !isFilePickerOpen || !isToolPickerOpen) {
      chatInputRef.current?.focus()
    }
  }, [isPromptPickerOpen, isFilePickerOpen, isToolPickerOpen])

  const handleNewChat = async () => {
    console.log("[Handler] 4. (handleNewChat): CALLED.") // ✅ لاگ ۴
    if (!selectedWorkspace) return
    console.log('[Handler] 5. (handleNewChat): Calling setUserInput("")')
    setUserInput("")
    setChatMessages([])
    setSelectedChat(null)
    setChatFileItems([])
    setIsGenerating(false)
    setFirstTokenReceived(false)
    setChatFiles([])
    setChatImages([])
    setNewMessageFiles([])
    setNewMessageImages([])
    setShowFilesDisplay(false)
    setIsPromptPickerOpen(false)
    setIsFilePickerOpen(false)
    setSelectedTools([])
    setToolInUse("none")

    if (selectedAssistant) {
      setChatSettings({
        model: selectedAssistant.model as LLMID,
        prompt: selectedAssistant.prompt,
        temperature: selectedAssistant.temperature,
        contextLength: selectedAssistant.context_length,
        includeProfileContext: selectedAssistant.include_profile_context,
        includeWorkspaceInstructions:
          selectedAssistant.include_workspace_instructions,
        embeddingsProvider: selectedAssistant.embeddings_provider as
          | "openai"
          | "local"
      })

      let allFiles = []

      const assistantFiles = (
        await getAssistantFilesByAssistantId(selectedAssistant.id)
      ).files
      allFiles = [...assistantFiles]
      const assistantCollections = (
        await getAssistantCollectionsByAssistantId(selectedAssistant.id)
      ).collections
      for (const collection of assistantCollections) {
        const collectionFiles = (
          await getCollectionFilesByCollectionId(collection.id)
        ).files
        allFiles = [...allFiles, ...collectionFiles]
      }
      const assistantTools = (
        await getAssistantToolsByAssistantId(selectedAssistant.id)
      ).tools

      setSelectedTools(assistantTools)
      setChatFiles(
        allFiles.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          file: null
        }))
      )

      if (allFiles.length > 0) setShowFilesDisplay(true)
    } else if (selectedPreset) {
      setChatSettings({
        model: selectedPreset.model as LLMID,
        prompt: selectedPreset.prompt,
        temperature: selectedPreset.temperature,
        contextLength: selectedPreset.context_length,
        includeProfileContext: selectedPreset.include_profile_context,
        includeWorkspaceInstructions:
          selectedPreset.include_workspace_instructions,
        embeddingsProvider: selectedPreset.embeddings_provider as
          | "openai"
          | "local"
      })
    }
    const targetUrl = `/${selectedWorkspace.id}/chat`
    if (pathname !== targetUrl) {
      router.push(targetUrl)
    }
    // return router.push(`/${selectedWorkspace.id}/chat`)
  }

  const handleFocusChatInput = () => {
    chatInputRef.current?.focus()
  }

  const handleStopMessage = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  // این کد را در فایل use-chat-handler.tsx قرار دهید

  const handleSendMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    const startingInput = messageContent

    // const b64Images = newMessageImages.map(image => image.base64)
    let {
      tempUserChatMessage,
      tempAssistantChatMessage
    } = // از let استفاده کنید
      createTempMessages(
        messageContent,
        chatMessages,
        chatSettings!,
        // b64Images,
        newMessageImages,
        isRegeneration,
        setChatMessages,
        selectedAssistant,
        setChatImages
      )
    let tempImageUrl: string | null = null
    try {
      if (isRegeneration) {
        setChatMessages(chatMessages)
      } else {
        setChatMessages(prev => [...prev, tempUserChatMessage])
      }

      setUserInput("")
      setIsGenerating(true)
      setIsPromptPickerOpen(false)
      setIsFilePickerOpen(false)
      setNewMessageImages([])
      setNewMessageFiles([])
      setShowFilesDisplay(false)
      const newAbortController = new AbortController()
      setAbortController(newAbortController)

      let modelData = [
        ...models.map(model => ({
          modelId: model.model_id as LLMID,
          modelName: model.name,
          provider: "custom" as ModelProvider,
          hostedId: model.id,
          platformLink: "",
          imageInput: false
        })),
        ...LLM_LIST,
        ...availableLocalModels,
        ...availableOpenRouterModels
      ].find(llm => llm.modelId === chatSettings?.model)

      // ✨ [تغییر جدید] هدایت مستقیم مدل‌های خاص به OpenRouter
      // این کار باعث می‌شود درخواست مستقیماً به /api/chat/openrouter برود
      const DIRECT_OPENROUTER_MODELS = [
        "gpt-5",
        "gpt-5-mini",
        "gpt-5-nano",
        "gpt-5-codex",
        "google/gemini-2.5-flash-image"
      ]

      if (modelData && DIRECT_OPENROUTER_MODELS.includes(modelData.modelId)) {
        modelData = { ...modelData, provider: "openrouter" as ModelProvider }
      }

      validateChatSettings(
        chatSettings,
        modelData,
        profile,
        selectedWorkspace,
        messageContent
      )
      let currentChat = selectedChat ? { ...selectedChat } : null
      if (!currentChat) {
        currentChat = await handleCreateChat(
          chatSettings!,
          profile!,
          selectedWorkspace!,
          messageContent,
          selectedAssistant!,
          newMessageFiles,
          setSelectedChat,
          setChats,
          setChatFiles
        )
      }

      let retrievedFileItems: Tables<"file_items">[] = []

      if (
        (newMessageFiles.length > 0 || chatFiles.length > 0) &&
        useRetrieval
      ) {
        setToolInUse("retrieval")
        retrievedFileItems = await handleRetrieval(
          messageContent,
          newMessageFiles,
          chatFiles,
          chatSettings!.embeddingsProvider,
          sourceCount
        )
      }

      const payload: ChatPayload = {
        chatSettings: chatSettings!,
        workspaceInstructions: selectedWorkspace!.instructions || "",
        chatMessages: isRegeneration
          ? [...chatMessages]
          : [...chatMessages, tempUserChatMessage], // از پیام موقت ساخته شده در ابتدا استفاده می‌کنیم
        assistant:
          selectedChat?.assistant_id && selectedAssistant
            ? selectedAssistant
            : null,
        messageFileItems: retrievedFileItems,
        chatFileItems: chatFileItems
      }
      let generatedText = ""
      let assistantFileUrl: string | null = null

      // ✨ [تغییر] چک کردن مدل‌های ساخت عکس قبل از ارسال
      if (
        payload.chatSettings.model === "dall-e-3" ||
        payload.chatSettings.model === "google/gemini-2.5-flash-image"
      ) {
        setToolInUse("image_generation")
      }

      // تمام شاخه‌های if/else را پوشش می‌دهیم
      if (payload.chatSettings.model.includes("-tts")) {
        // منطق TTS شما...
      } else if (payload.chatSettings.model === "dall-e-3") {
        // منطق DALL-E شما...
      } else {
        const aiResponse = await (modelData!.provider === "ollama"
          ? handleLocalChat(
              payload,
              profile!,
              chatSettings!,
              tempAssistantChatMessage,
              isRegeneration,
              newAbortController,
              setIsGenerating,
              setFirstTokenReceived,
              setChatMessages,
              setToolInUse
            )
          : handleHostedChat(
              payload,
              profile!,
              modelData!,
              currentChat.id, // ✅ <-- باید در جایگاه ۴ باشد
              tempAssistantChatMessage, // <-- حالا در جایگاه ۵ است
              isRegeneration,
              newAbortController,
              newMessageImages,
              chatImages,
              setIsGenerating,
              setFirstTokenReceived,
              setChatMessages,
              setToolInUse
            ))

        // حالا خروجی هر دو تابع handleLocalChat و handleHostedChat یکسان است

        if (aiResponse.type === "image") {
          const imageBlob = aiResponse.data as Blob
          tempImageUrl = URL.createObjectURL(imageBlob) // ✨ NEW: ایجاد object URL
          generatedText = `![Generated Image](${tempImageUrl})` // ✨ NEW: نمایش فوری با object URL

          // ✨ NEW: به روز رسانی پیام دستیار در UI با تصویر موقت
          setChatMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.message.id === tempAssistantChatMessage.message.id
                ? {
                    ...msg,
                    message: { ...msg.message, content: generatedText }
                  }
                : msg
            )
          )
          const fileExt = imageBlob.type.split("/")[1] || "png"
          const imageName = `ai-generated-${Date.now()}.${fileExt}`
          const imageFile = new File([imageBlob], imageName, {
            type: imageBlob.type
          })

          const filePath = `${profile!.user_id}/${currentChat.id}/${imageName}`
          const uploadedPath = await uploadMessageImage(filePath, imageFile)

          if (!uploadedPath) {
            throw new Error("Image upload was successful but returned no path.")
          }

          const {
            data: { publicUrl }
          } = supabase.storage.from("message_images").getPublicUrl(uploadedPath)

          assistantFileUrl = publicUrl // این URL نهایی برای ذخیره در دیتابیس است

          // ✨ NEW: آزاد کردن object URL پس از دریافت public URL
          URL.revokeObjectURL(tempImageUrl)

          generatedText = `![Generated Image](${publicUrl})`
          setChatMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.message.id === tempAssistantChatMessage.message.id
                ? {
                    ...msg,
                    message: { ...msg.message, content: generatedText }
                  }
                : msg
            )
          )
        } else {
          generatedText = aiResponse.data
        }
      }

      if (currentChat && !isRegeneration) {
        await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })
        setChats(prevChats =>
          prevChats.map(prevChat =>
            prevChat.id === currentChat!.id ? currentChat : prevChat
          )
        )
      }

      await handleCreateMessages(
        chatMessages,
        currentChat!,
        profile!,
        modelData!,
        messageContent,
        assistantFileUrl
          ? `![Generated Image](${assistantFileUrl})`
          : generatedText, // مطمئن شوید که پیام نهایی با publicUrl است
        assistantFileUrl,
        newMessageImages,
        isRegeneration,
        retrievedFileItems,
        setChatMessages,
        setChatFileItems,
        setChatImages,
        selectedAssistant
      )

      setIsGenerating(false)
      setFirstTokenReceived(false)
    } catch (error: any) {
      setIsGenerating(false)
      setFirstTokenReceived(false)
      setUserInput(startingInput)
      setChatMessages(prevMessages =>
        prevMessages.filter(
          message =>
            message.message.id !== tempUserChatMessage.message.id &&
            message.message.id !== tempAssistantChatMessage.message.id // ✨ NEW: حذف پیام دستیار موقت در صورت خطا
        )
      )
      if (tempImageUrl) {
        // ✨ NEW: آزاد کردن object URL در صورت خطا
        URL.revokeObjectURL(tempImageUrl)
      }
      toast.error(error.message || "An unexpected error occurred.")
    }
  }

  const handleSendEdit = async (
    editedContent: string,
    sequenceNumber: number
  ) => {
    if (!selectedChat) return

    await deleteMessagesIncludingAndAfter(
      selectedChat.user_id,
      selectedChat.id,
      sequenceNumber
    )

    const filteredMessages = chatMessages.filter(
      chatMessage => chatMessage.message.sequence_number < sequenceNumber
    )

    setChatMessages(filteredMessages)
    handleSendMessage(editedContent, filteredMessages, false)
  }

  return {
    chatInputRef,
    handleNewChat,
    handleSendMessage,
    handleFocusChatInput,
    handleStopMessage,
    handleSendEdit,
    setChatMessages
  }
}
