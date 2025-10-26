"use client"

import { ChatbotUIContext } from "@/context/context"
import { Tables } from "@/supabase/types"
import {
  ChatFile,
  ChatMessage,
  ChatSettings,
  LLM,
  MessageImage,
  OpenRouterLLM,
  WorkspaceImage
} from "@/types"
import { AssistantImage } from "@/types/images/assistant-image"
import { VALID_ENV_KEYS } from "@/types/valid-keys"
import { FC, useCallback, useEffect, useMemo, useState } from "react"

interface ChatbotUIProviderProps {
  children: React.ReactNode
}

export const ChatbotUIProvider: FC<ChatbotUIProviderProps> = ({ children }) => {
  // این بخش تمام state های برنامه را با useState تعریف می‌کند
  // PROFILE STORE
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null)
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null)
  // ITEMS STORE
  const [assistants, setAssistants] = useState<Tables<"assistants">[]>([])
  const [collections, setCollections] = useState<Tables<"collections">[]>([])
  const [chats, setChats] = useState<Tables<"chats">[]>([])
  const [files, setFiles] = useState<Tables<"files">[]>([])
  const [folders, setFolders] = useState<Tables<"folders">[]>([])
  const [models, setModels] = useState<Tables<"models">[]>([])
  const [presets, setPresets] = useState<Tables<"presets">[]>([])
  const [prompts, setPrompts] = useState<Tables<"prompts">[]>([])
  const [tools, setTools] = useState<Tables<"tools">[]>([])
  const [workspaces, setWorkspaces] = useState<Tables<"workspaces">[]>([])

  // ATTACHMENTS STORE - ✨ state های کلیدی شما اینجا تعریف شده‌اند
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([])
  const [chatImages, setChatImages] = useState<MessageImage[]>([])
  const [newMessageFiles, setNewMessageFiles] = useState<ChatFile[]>([])
  const [newMessageImages, setNewMessageImages] = useState<MessageImage[]>([])
  const [showFilesDisplay, setShowFilesDisplay] = useState(false)

  // ... (بقیه state ها نیز باید به همین شکل اضافه شوند)
  // ... (برای سادگی، فقط موارد مربوط به مشکل شما را اینجا آورده‌ام)
  useEffect(() => {
    // این کد هر بار که chatSettings تغییر می‌کند اجرا می‌شود
    console.log("ChatSettings updated in provider:", chatSettings)
  }, [chatSettings]) // وابسته به chatSettings

  // 👇 این تابع آپدیت شده‌ی setChatSettings است (اختیاری اما بهتر)
  // این تابع به شما اجازه می‌دهد قبل از آپدیت state هم لاگ بگیرید
  const updateChatSettings = useCallback(
    (
      newSettings:
        | ChatSettings
        | ((prevState: ChatSettings | null) => ChatSettings | null)
    ) => {
      console.log("setChatSettings called in provider with:", newSettings) // <-- لاگ ۱: مقدار جدید دریافتی
      setChatSettings(prevState => {
        const updatedSettings =
          typeof newSettings === "function"
            ? newSettings(prevState)
            : newSettings
        console.log("Previous chatSettings in provider:", prevState) // <-- لاگ ۲: مقدار قبلی
        console.log("New chatSettings in provider will be:", updatedSettings) // <-- لاگ ۳: مقداری که ست می‌شود
        return updatedSettings
      })
    },
    []
  )
  const contextValue = useMemo(
    () => ({
      profile,
      setProfile,
      assistants,
      setAssistants,
      collections,
      setCollections,
      chats,
      setChats,
      files,
      setFiles,
      folders,
      setFolders,
      models,
      setModels,
      presets,
      setPresets,
      prompts,
      setPrompts,
      tools,
      setTools,
      workspaces,
      setWorkspaces,
      setChatSettings: updateChatSettings,
      chatFiles,
      setChatFiles,
      chatImages,
      setChatImages,
      newMessageFiles,
      setNewMessageFiles,
      newMessageImages,
      setNewMessageImages,
      showFilesDisplay,
      setShowFilesDisplay
      // ... (بقیه مقادیر را اینجا اضافه کنید)
    }),
    [
      profile,
      assistants,
      collections,
      chats,
      files,
      folders,
      models,
      presets,
      prompts,
      tools,
      workspaces,
      chatFiles,
      chatImages,
      newMessageFiles,
      newMessageImages,
      showFilesDisplay
      // ... (بقیه وابستگی‌ها)
    ]
  )

  return (
    <ChatbotUIContext.Provider value={contextValue as any}>
      {children}
    </ChatbotUIContext.Provider>
  )
}
