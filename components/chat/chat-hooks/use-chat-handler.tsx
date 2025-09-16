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

export const useChatHandler = () => {
  const router = useRouter()

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
    if (!selectedWorkspace) return

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

    return router.push(`/${selectedWorkspace.id}/chat`)
  }

  const handleFocusChatInput = () => {
    chatInputRef.current?.focus()
  }

  const handleStopMessage = () => {
    if (abortController) {
      abortController.abort()
    }
  }

  const handleSendMessage = async (
    messageContent: string,
    chatMessages: ChatMessage[],
    isRegeneration: boolean
  ) => {
    console.log("🚀 handleSendMessage HAS BEEN CALLED! 🚀")
    const startingInput = messageContent

    try {
      setUserInput("")
      setIsGenerating(true)
      setIsPromptPickerOpen(false)
      setIsFilePickerOpen(false)
      setNewMessageImages([])

      const newAbortController = new AbortController()
      setAbortController(newAbortController)

      const modelData = [
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

      validateChatSettings(
        chatSettings,
        modelData,
        profile,
        selectedWorkspace,
        messageContent
      )

      let currentChat = selectedChat ? { ...selectedChat } : null
      const b64Images = newMessageImages.map(image => image.base64)
      let retrievedFileItems: Tables<"file_items">[] = []

      if (
        (newMessageFiles.length > 0 || chatFiles.length > 0) &&
        useRetrieval
      ) {
        setToolInUse("retrieval")
        retrievedFileItems = await handleRetrieval(
          userInput,
          newMessageFiles,
          chatFiles,
          chatSettings!.embeddingsProvider,
          sourceCount
        )
      }

      const { tempUserChatMessage, tempAssistantChatMessage } =
        createTempMessages(
          messageContent,
          chatMessages,
          chatSettings!,
          b64Images,
          isRegeneration,
          setChatMessages,
          selectedAssistant
        )

      const payload: ChatPayload = {
        chatSettings: chatSettings!,
        workspaceInstructions: selectedWorkspace!.instructions || "",
        chatMessages: isRegeneration
          ? [...chatMessages]
          : [...chatMessages, tempUserChatMessage],
        assistant:
          selectedChat?.assistant_id && selectedAssistant
            ? selectedAssistant
            : null,
        messageFileItems: retrievedFileItems,
        chatFileItems: chatFileItems
      }

      // =================================================================
      // ✅✅✅ شروع ساختار اصلاح شده ✅✅✅
      // =================================================================

      // داخل تابع handleSendMessage توی useChatHandler.ts
      // =================================================================
      // ✅✅✅ شروع ساختار اصلاح شده ✅✅✅
      // =================================================================

      let generatedText = ""
      console.log(
        "🔴 CRITICAL DEBUG: Model is ==> ",
        payload.chatSettings.model
      )
      // ✅ شرط جدید برای شناسایی مدل‌های TTS
      if (payload.chatSettings.model.includes("-tts")) {
        setToolInUse("TTS") // ابزار در حال استفاده را مشخص کنید

        // فرض می‌کنیم یک endpoint جدید برای TTS ساخته‌اید یا از endpoint فعلی استفاده می‌کنید
        const response = await fetch("/api/chat/openai", {
          // یا هر endpoint دیگری
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chatSettings: payload.chatSettings,
            messages: [{ role: "user", content: messageContent }]
          }),
          signal: newAbortController.signal
        })

        setToolInUse("none")

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`TTS generation failed: ${errorText}`)
        }

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        console.log("✅ [Chat Handler] Audio URL created:", audioUrl)
        generatedText = audioUrl
        // به‌روزرسانی پیام دستیار در UI
        setChatMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.message.id === tempAssistantChatMessage.message.id
              ? {
                  ...msg,
                  message: {
                    ...msg.message,
                    content: audioUrl // URL صوتی را مستقیماً در محتوای پیام قرار می‌دهیم
                  }
                }
              : msg
          )
        )
      } else if (payload.chatSettings.model === "dall-e-3") {
        setToolInUse("drawing")

        const response = await fetch("/api/chat/dalle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: messageContent
          })
        })

        setToolInUse("none")

        if (!response.ok) {
          // اگر پاسخ موفقیت‌آمیز نبود، متن خطا را چاپ کن
          const errorText = await response.text()
          console.error("Error Response Body:", errorText)
          throw new Error(`Failed to generate image: ${response.statusText}`)
        }
        const { imageUrl } = await response.json()
        if (!imageUrl) {
          throw new Error("No image URL returned from API")
        }

        const imageMarkdown = `![Generated Image](${imageUrl})`

        setChatMessages((prevMessages: ChatMessage[]) =>
          prevMessages.map((msg: ChatMessage) =>
            msg.message.id === tempAssistantChatMessage.message.id
              ? {
                  ...msg,
                  message: { ...msg.message, content: imageMarkdown }
                }
              : msg
          )
        )

        generatedText = imageMarkdown
      } else {
        // 🧠 اگر مدل DALL-E 3 نبود، منطق قبلی برای بقیه مدل‌ها اجرا می‌شود
        if (selectedTools.length > 0) {
          setToolInUse("Tools")

          const formattedMessages = await buildFinalMessages(
            payload,
            profile!,
            chatImages
          )

          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              chatSettings: payload.chatSettings,
              messages: formattedMessages,
              enableWebSearch: Boolean(chatSettings?.enableWebSearch)
            })
          })

          setToolInUse("none")

          generatedText = await processResponse(
            response,
            isRegeneration
              ? payload.chatMessages[payload.chatMessages.length - 1]
              : tempAssistantChatMessage,
            true,
            newAbortController,
            setFirstTokenReceived,
            setChatMessages,
            setToolInUse
          )
        } else {
          // منطق برای مدل‌های دیگر بدون ابزار (Ollama یا سایر مدل‌های Hosted)
          if (modelData!.provider === "ollama") {
            generatedText = await handleLocalChat(
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
          } else {
            generatedText = await handleHostedChat(
              payload,
              profile!,
              modelData!,
              tempAssistantChatMessage,
              isRegeneration,
              newAbortController,
              newMessageImages,
              chatImages,
              setIsGenerating,
              setFirstTokenReceived,
              setChatMessages,
              setToolInUse
            )
          }
        }
      }

      // =================================================================
      // 🔚🔚🔚 پایان ساختار اصلاح شده 🔚🔚🔚
      // =================================================================

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
      } else {
        const updatedChat = await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })
        setChats(prevChats =>
          prevChats.map(prevChat =>
            prevChat.id === updatedChat.id ? updatedChat : prevChat
          )
        )
      }

      await handleCreateMessages(
        chatMessages,
        currentChat!,
        profile!,
        modelData!,
        messageContent,
        generatedText,
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
