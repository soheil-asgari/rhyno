// Only used in use-chat-handler.tsx to keep it clean

import { createChatFiles } from "@/db/chat-files"
import { createChat } from "@/db/chats"
import { createMessageFileItems } from "@/db/message-file-items"
import { createMessages, updateMessage } from "@/db/messages"
import { uploadMessageImage } from "@/db/storage/message-images"
import {
  buildFinalMessages,
  adaptMessagesForGoogleGemini
} from "@/lib/build-prompt"
import { consumeReadableStream } from "@/lib/consume-stream"
import { Tables, TablesInsert } from "@/supabase/types"
import {
  ChatFile,
  ChatMessage,
  ChatPayload,
  ChatSettings,
  LLM,
  MessageImage
} from "@/types"
import React from "react"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/lib/supabase/browser-client"

export const getAuthToken = async (): Promise<string | undefined> => {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  return session?.access_token
}
export const validateChatSettings = (
  chatSettings: ChatSettings | null,
  modelData: LLM | undefined,
  profile: Tables<"profiles"> | null,
  selectedWorkspace: Tables<"workspaces"> | null,
  messageContent: string
) => {
  if (!chatSettings) {
    throw new Error("Chat settings not found")
  }

  if (!modelData) {
    throw new Error("Model not found")
  }

  if (!profile) {
    throw new Error("Profile not found")
  }

  if (!selectedWorkspace) {
    throw new Error("Workspace not found")
  }

  if (!messageContent) {
    throw new Error("Message content not found")
  }
}

export const handleRetrieval = async (
  userInput: string,
  newMessageFiles: ChatFile[],
  chatFiles: ChatFile[],
  embeddingsProvider: "openai" | "local",
  sourceCount: number
) => {
  const session = (await supabase.auth.getSession()).data.session
  if (!session) {
    throw new Error("User is not authenticated.")
  }
  const token = session.access_token
  console.log("TOKEN BEING SENT TO RETRIEVE:", token)
  const allFileIds = [
    ...newMessageFiles.map(file => file.id),
    ...chatFiles.map(file => file.id)
  ]
  const response = await fetch("/api/retrieval/retrieve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // ۳. هدر Authorization را اضافه کنید
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      userInput,
      fileIds: allFileIds,
      sourceCount
    })
  })

  // ۴. مدیریت صحیح خطاها
  if (!response.ok) {
    const errorData = await response.json()
    console.error("Error retrieving:", response.status, errorData)
    throw new Error(
      errorData.message || `Failed to retrieve data (${response.status})`
    )
  }

  const json = await response.json()
  return json.results
}

export const createTempMessages = (
  messageContent: string,
  chatMessages: ChatMessage[],
  chatSettings: ChatSettings,
  // b64Images: string[], // ❌ حذف شد
  newMessageImages: MessageImage[], // ✨ [اصلاح ۱] اضافه شد
  isRegeneration: boolean,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  selectedAssistant: Tables<"assistants"> | null,
  setChatImages: React.Dispatch<React.SetStateAction<MessageImage[]>> // ✨ [اصلاح ۲] اضافه شد
) => {
  // ✨ [اصلاح ۳] یک ID موقت برای پیام می‌سازیم
  const tempMessageId = uuidv4()

  let tempUserChatMessage: ChatMessage = {
    message: {
      chat_id: "",
      assistant_id: null,
      content: messageContent,
      created_at: "",
      file_url: null,
      id: tempMessageId, // ✨ [اصلاح ۴] از ID موقت استفاده می‌کنیم
      image_paths: [], // این توسط استیت chatImages مدیریت می‌شود
      model: chatSettings.model,
      role: "user",
      sequence_number: chatMessages.length,
      updated_at: "",
      user_id: "",
      audio_url: ""
    },
    fileItems: []
  }

  let tempAssistantChatMessage: ChatMessage = {
    message: {
      chat_id: "",
      assistant_id: selectedAssistant?.id || null,
      content: "",
      created_at: "",
      file_url: null,
      id: uuidv4(),
      image_paths: [],
      model: chatSettings.model,
      role: "assistant",
      sequence_number: chatMessages.length + 1,
      updated_at: "",
      user_id: "",
      audio_url: ""
    },
    fileItems: []
  }

  // ✨ [اصلاح ۵] بلافاصله عکس‌های موقت را به استیت chatImages اضافه می‌کنیم
  // این باعث می‌شود کامپوننت MessageImages آنها را فوراً رندر کند
  const tempImages = newMessageImages.map(image => ({
    ...image,
    messageId: tempMessageId // عکس‌ها را به پیام موقت متصل می‌کنیم
  }))

  if (!isRegeneration) {
    setChatImages(prev => [...prev, ...tempImages])
  }

  let newMessages = []

  if (isRegeneration) {
    const lastMessageIndex = chatMessages.length - 1
    chatMessages[lastMessageIndex].message.content = ""
    newMessages = [...chatMessages]
  } else {
    newMessages = [...chatMessages, tempAssistantChatMessage]
  }

  setChatMessages(newMessages)

  return {
    tempUserChatMessage,
    tempAssistantChatMessage
  }
}

export const handleLocalChat = async (
  payload: ChatPayload,
  profile: Tables<"profiles">,
  chatSettings: ChatSettings,
  tempAssistantMessage: ChatMessage,
  isRegeneration: boolean,
  newAbortController: AbortController,
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
) => {
  const formattedMessages = await buildFinalMessages(payload, profile, [])

  // Ollama API: https://github.com/jmorganca/ollama/blob/main/docs/api.md
  const response = await fetchChatResponse(
    process.env.NEXT_PUBLIC_OLLAMA_URL + "/api/chat",
    {
      model: chatSettings.model,
      messages: formattedMessages,
      options: {
        temperature: payload.chatSettings.temperature
      }
    },
    false,
    newAbortController,
    setIsGenerating,
    setChatMessages
  )

  return await processResponse(
    response,
    isRegeneration
      ? payload.chatMessages[payload.chatMessages.length - 1]
      : tempAssistantMessage,
    false,
    newAbortController,
    setFirstTokenReceived,
    setChatMessages,
    setToolInUse
  )
}

export const handleHostedChat = async (
  payload: ChatPayload,
  profile: Tables<"profiles">,
  modelData: LLM,
  chatId: string,
  tempAssistantChatMessage: ChatMessage,
  isRegeneration: boolean,

  newAbortController: AbortController,
  newMessageImages: MessageImage[],
  chatImages: MessageImage[],
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
) => {
  const provider =
    modelData.provider === "openai" && profile.use_azure_openai
      ? "azure"
      : modelData.provider

  const allImages = [...chatImages, ...newMessageImages]

  let draftMessages = await buildFinalMessages(payload, profile, allImages)

  let formattedMessages: any[] = []
  if (provider === "google") {
    formattedMessages = await adaptMessagesForGoogleGemini(
      payload,
      draftMessages
    )
  } else {
    formattedMessages = draftMessages
  }

  const apiEndpoint =
    provider === "custom" ? "/api/chat/custom" : `/api/chat/${provider}`

  const requestBody = {
    chatSettings: payload.chatSettings,
    messages: formattedMessages,
    customModelId: provider === "custom" ? modelData.hostedId : "",
    chat_id: chatId,
    is_user_message_saved: true
  }
  const token = await getAuthToken()
  const response = await fetchChatResponse(
    apiEndpoint,
    requestBody,
    true,
    newAbortController,
    setIsGenerating,
    setChatMessages,
    token
  )

  return await processResponse(
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
}

export const fetchChatResponse = async (
  url: string,
  body: object,
  isHosted: boolean,
  controller: AbortController,
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  token?: string // ✨ اضافه کردن پارامتر اختیاری توکن
) => {
  const headers: HeadersInit = {
    "Content-Type": "application/json"
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}` // ✨ اضافه کردن هدر Authorization
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal
  })

  if (!response.ok) {
    if (response.status === 404 && !isHosted) {
      toast.error(
        "Model not found. Make sure you have it downloaded via Ollama."
      )
    }

    const errorData = await response.json()
    toast.error(errorData.message)
    setIsGenerating(false)
    setChatMessages(prevMessages => prevMessages.slice(0, -2))
  }

  return response
}

export const processResponse = async (
  response: Response,
  lastChatMessage: ChatMessage,
  isHosted: boolean,
  controller: AbortController,
  setFirstTokenReceived: React.Dispatch<React.SetStateAction<boolean>>,
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setToolInUse: React.Dispatch<React.SetStateAction<string>>
): Promise<{ type: "text"; data: string } | { type: "image"; data: Blob }> => {
  const contentType = response.headers.get("content-type")

  // منطق تصویر (بدون تغییر)
  if (contentType && contentType.startsWith("image/")) {
    const imageBlob = await response.blob()
    setChatMessages(prev =>
      prev.map(chatMessage => {
        if (chatMessage.message.id === lastChatMessage.message.id) {
          return {
            ...chatMessage,
            message: {
              ...chatMessage.message,
              content: "[Image generated...]"
            }
          }
        }
        return chatMessage
      })
    )
    return { type: "image", data: imageBlob }
  }

  // ✨ [تصحیح نهایی] منطق پردازش استریم متن
  if (response.body) {
    let fullText = ""
    let buffer = "" // بافر برای مدل محلی

    // console.log("Starting to process response stream...") // <-- لاگ ۱

    await consumeReadableStream(
      response.body,
      (chunk: string) => {
        setFirstTokenReceived(true)
        // console.log("STREAM CHUNK RECEIVED:", chunk) // <-- لاگ ۲: این مهم‌ترین لاگ است

        if (isHosted) {
          // --- منطق برای بک‌اند ما (OpenAI/route.ts) ---
          let currentChunk = chunk
          let textReceived = false

          // ۱. چک می‌کنیم آیا سیگنال در این چانک وجود دارد؟
          if (currentChunk.includes("%%TOOL_CALL:search%%")) {
            // console.log("✅ Search signal detected!") // <-- لاگ ۳
            setToolInUse("search")
            // سیگنال را از چانک حذف کن تا نمایش داده نشود
            currentChunk = currentChunk.replace("%%TOOL_CALL:search%%", "")
          }

          // ۲. آیا متنی (به جز سیگنال) در چانک باقی مانده است؟
          if (currentChunk.length > 0) {
            // console.log("Text content detected in chunk.") // <-- لاگ ۴
            setToolInUse("none") // وضعیت را به "در حال تایپ" برگردان
            fullText += currentChunk
            textReceived = true
          }

          // (اگر چانک *فقط* سیگنال بود، `currentChunk.length` صفر است،
          // `setToolInUse("none")` فراخوانی نمی‌شود و "Searching" باقی می‌ماند)
        } else {
          // --- منطق برای مدل‌های محلی (Ollama) ---
          buffer += chunk
          let contentToAdd = ""
          try {
            contentToAdd = buffer
              .trimEnd()
              .split("\n")
              .reduce((acc, line) => acc + JSON.parse(line).message.content, "")
            buffer = ""
            setToolInUse("none")
            fullText += contentToAdd
          } catch (error) {
            // JSON کامل نیست، منتظر بمان
          }
        }

        // آپدیت UI
        setChatMessages(prev =>
          prev.map(chatMessage => {
            if (chatMessage.message.id === lastChatMessage.message.id) {
              return {
                ...chatMessage,
                message: { ...chatMessage.message, content: fullText }
              }
            }
            return chatMessage
          })
        )
      },
      controller.signal
    )

    // console.log("Stream processing finished.") // <-- لاگ ۵
    return { type: "text", data: fullText }
  } else {
    console.error("Response body is null")
    return { type: "text", data: "" }
  }
}

export const handleCreateChat = async (
  chatSettings: ChatSettings,
  profile: Tables<"profiles">,
  selectedWorkspace: Tables<"workspaces">,
  messageContent: string,
  selectedAssistant: Tables<"assistants">,
  newMessageFiles: ChatFile[],
  setSelectedChat: React.Dispatch<React.SetStateAction<Tables<"chats"> | null>>,
  setChats: React.Dispatch<React.SetStateAction<Tables<"chats">[]>>,
  setChatFiles: React.Dispatch<React.SetStateAction<ChatFile[]>>
) => {
  const createdChat = await createChat({
    user_id: profile.user_id,
    workspace_id: selectedWorkspace.id,
    assistant_id: selectedAssistant?.id || null,
    context_length: chatSettings.contextLength,
    include_profile_context: chatSettings.includeProfileContext,
    include_workspace_instructions: chatSettings.includeWorkspaceInstructions,
    model: chatSettings.model,
    name: messageContent.substring(0, 100),
    prompt: chatSettings.prompt,
    temperature: chatSettings.temperature,
    embeddings_provider: chatSettings.embeddingsProvider
  })

  setSelectedChat(createdChat)
  setChats(chats => [createdChat, ...chats])

  await createChatFiles(
    newMessageFiles.map(file => ({
      user_id: profile.user_id,
      chat_id: createdChat.id,
      file_id: file.id
    }))
  )

  setChatFiles(prev => [...prev, ...newMessageFiles])

  return createdChat
}

export const handleCreateMessages = async (
  chatMessages: ChatMessage[],
  currentChat: Tables<"chats">,
  profile: Tables<"profiles">,
  modelData: LLM,
  messageContent: string,
  generatedText: string,
  assistantFileUrl: string | null, // ✨ ترتیب صحیح پارامترها
  newMessageImages: MessageImage[],
  isRegeneration: boolean,
  retrievedFileItems: Tables<"file_items">[],
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setChatFileItems: React.Dispatch<
    React.SetStateAction<Tables<"file_items">[]>
  >,
  setChatImages: React.Dispatch<React.SetStateAction<MessageImage[]>>,
  selectedAssistant: Tables<"assistants"> | null
) => {
  const sanitizedMessageContent = messageContent.replace(
    /[\u200B-\u200D\uFEFF]/g,
    ""
  )
  const userTimestamp = new Date().toISOString()
  const assistantTimestamp = new Date(
    new Date(userTimestamp).getTime() + 1000
  ).toISOString()
  // --- 👆👆👆 ---.

  const finalUserMessage: TablesInsert<"messages"> = {
    chat_id: currentChat.id,
    assistant_id: null,
    user_id: profile.user_id,
    content: sanitizedMessageContent,
    model: modelData.modelId,
    role: "user",
    sequence_number: chatMessages.length,
    image_paths: [],
    file_url: null,
    created_at: userTimestamp
  }

  const finalAssistantMessage: TablesInsert<"messages"> = {
    chat_id: currentChat.id,
    assistant_id: selectedAssistant?.id || null,
    user_id: profile.user_id,
    content: generatedText.trim() === "" ? " " : generatedText,
    model: modelData.modelId,
    role: "assistant",
    sequence_number: chatMessages.length + 1,
    image_paths: [],
    file_url: assistantFileUrl,
    created_at: assistantTimestamp
  }

  let finalChatMessages: ChatMessage[] = []

  if (isRegeneration) {
    const lastMessage = chatMessages[chatMessages.length - 1]
    if (lastMessage.message.role === "assistant") {
      // ✨ اصلاح: در زمان بازسازی، file_url را هم آپدیت می‌کنیم
      const updatedMessage = await updateMessage(lastMessage.message.id, {
        content: generatedText,
        file_url: assistantFileUrl
      })
      chatMessages[chatMessages.length - 1].message = updatedMessage
      setChatMessages([...chatMessages])
    }
  } else {
    // ✨ اصلاح: منطق کامل بلوک else را برمی‌گردانیم
    const createdMessages = await createMessages([
      finalUserMessage,
      finalAssistantMessage
    ])

    // Upload each image (stored in newMessageImages) for the user message to message_images bucket
    const uploadPromises = newMessageImages
      .filter(obj => obj.file !== null)
      .map(obj => {
        let filePath = `${profile.user_id}/${currentChat.id}/${
          createdMessages[0].id
        }/${uuidv4()}`

        return uploadMessageImage(filePath, obj.file as File).catch(error => {
          console.error(`Failed to upload image at ${filePath}:`, error)
          return null
        })
      })

    const paths = (await Promise.all(uploadPromises)).filter(
      Boolean
    ) as string[]

    setChatImages(prevImages => [
      ...prevImages,
      ...newMessageImages.map((obj, index) => ({
        ...obj,
        messageId: createdMessages[0].id,
        path: paths[index]
      }))
    ])

    const updatedMessage = await updateMessage(createdMessages[0].id, {
      ...createdMessages[0],
      image_paths: paths
    })

    const createdMessageFileItems = await createMessageFileItems(
      retrievedFileItems.map(fileItem => {
        return {
          user_id: profile.user_id,
          message_id: createdMessages[1].id,
          file_item_id: fileItem.id
        }
      })
    )

    finalChatMessages = [
      ...chatMessages,
      {
        message: updatedMessage,
        fileItems: []
      },
      {
        message: createdMessages[1],
        fileItems: retrievedFileItems.map(fileItem => fileItem.id)
      }
    ]

    setChatFileItems(prevFileItems => {
      const newFileItems = retrievedFileItems.filter(
        fileItem => !prevFileItems.some(prevItem => prevItem.id === fileItem.id)
      )

      return [...prevFileItems, ...newFileItems]
    })

    setChatMessages(finalChatMessages)
  }
}
