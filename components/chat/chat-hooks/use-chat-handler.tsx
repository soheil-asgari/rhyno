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
import { toast } from "sonner"
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
    } else if (selectedWorkspace) {
      // setChatSettings({
      //   model: (selectedWorkspace.default_model ||
      //     "gpt-4-1106-preview") as LLMID,
      //   prompt:
      //     selectedWorkspace.default_prompt ||
      //     "You are a friendly, helpful AI assistant.",
      //   temperature: selectedWorkspace.default_temperature || 0.5,
      //   contextLength: selectedWorkspace.default_context_length || 4096,
      //   includeProfileContext:
      //     selectedWorkspace.include_profile_context || true,
      //   includeWorkspaceInstructions:
      //     selectedWorkspace.include_workspace_instructions || true,
      //   embeddingsProvider:
      //     (selectedWorkspace.embeddings_provider as "openai" | "local") ||
      //     "openai"
      // })
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

      let payload: ChatPayload = {
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

      let generatedText = ""

      if (selectedTools.length > 0) {
        setToolInUse("Tools")
        console.log("Before calling buildFinalMessages")
        const formattedMessages = await buildFinalMessages(
          payload,
          profile!,
          chatImages
        )
        console.log("Formatted Messages Before Sending:", formattedMessages)
        console.log("Formatted Messages Before Sending:", formattedMessages)
        console.log("starrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrt")
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chatSettings: payload.chatSettings,
            messages: formattedMessages,
            enableWebSearch: Boolean(chatSettings?.enableWebSearch) // 👈 اینجا
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
        // ...
        // ...
        // ...
      } else {
        // اگر مدل DALL-E 3 بود، این منطق اجرا می‌شود
        if (payload.chatSettings.model === "dall-e-3") {
          // یک آرایه جدید فقط با پیام فعلی کاربر می‌سازیم
          const dallEPromptMessage = [
            {
              role: "user",
              content: messageContent // messageContent همان ورودی کاربر است
            }
          ]

          // درخواست را فقط با همان یک پیام ارسال می‌کنیم
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chatSettings: payload.chatSettings,
              messages: dallEPromptMessage,
              enableWebSearch: Boolean(chatSettings?.enableWebSearch)
            })
          })

          // پاسخ را پردازش کرده و تصویر را نمایش می‌دهیم
          if (!response.ok) {
            const errorData = await response.json()
            console.error("Error from DALL-E API:", errorData.message)
            throw new Error(errorData.message || "Failed to generate image.")
          }
          const data = await response.json()
          const imageUrl = data.imageUrl
          const imageMarkdown = `![Generated Image](${imageUrl})`

          setChatMessages(prevMessages =>
            prevMessages.map(msg =>
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
          // برای بقیه مدل‌ها، کد به روال سابق عمل می‌کند
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

        // ----------- پایان کد نهایی و صحیح -----------
      }
      // ...
      // ----------- پایان کد جدید و اصلاح شده -----------
      // ...
      // ----------- پایان تغییرات -----------

      // ...
      if (!currentChat) {
        // وقتی چتی هنوز وجود نداره → یه چت جدید می‌سازیم
        currentChat = await handleCreateChat(
          chatSettings!,
          profile!,
          selectedWorkspace!,
          messageContent,
          selectedAssistant!, // اینجا مطمئنیم که assistant وجود داره
          newMessageFiles,
          setSelectedChat,
          setChats,
          setChatFiles
        )
      } else {
        // وقتی چت وجود داره → فقط تاریخ آخرین آپدیت رو تغییر میدیم
        const updatedChat = await updateChat(currentChat.id, {
          updated_at: new Date().toISOString()
        })

        setChats(prevChats => {
          const updatedChats = prevChats.map(prevChat =>
            prevChat.id === updatedChat.id ? updatedChat : prevChat
          )
          return updatedChats
        })
      }

      // ✅ اینجا currentChat دیگه قطعاً null نیست
      await handleCreateMessages(
        chatMessages,
        currentChat!, // non-null تضمین‌شده
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
      // "any" را اضافه کنید تا به "message" دسترسی داشته باشید
      setIsGenerating(false)
      setFirstTokenReceived(false)
      setUserInput(startingInput)

      // این خط جدید و کلیدی است
      // یک پیام خطا به کاربر نمایش می‌دهد
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
    prompt,
    handleNewChat,
    handleSendMessage,
    handleFocusChatInput,
    handleStopMessage,
    handleSendEdit
  }
}
