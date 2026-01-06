"use client"

import { ChatbotUIContext } from "@/context/context"
import { getProfileByUserId } from "@/db/profile"
import { getWorkspaceImageFromStorage } from "@/db/storage/workspace-images"
import { getWorkspacesByUserId } from "@/db/workspaces"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import {
  fetchHostedModels,
  fetchOpenRouterModels
} from "@/lib/models/fetch-models"
import { supabase } from "@/lib/supabase/browser-client"
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
import { useRouter } from "next/navigation"
import { FC, useEffect, useMemo, useState, useRef } from "react"

interface GlobalStateProps {
  children: React.ReactNode
}

export const GlobalState: FC<GlobalStateProps> = ({ children }) => {
  const router = useRouter()

  // برای جلوگیری از لود تکراری دیتا
  const hasInitialized = useRef(false)

  // PROFILE STORE
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null)

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

  // MODELS STORE
  const [envKeyMap, setEnvKeyMap] = useState<Record<string, VALID_ENV_KEYS>>({})
  const [availableHostedModels, setAvailableHostedModels] = useState<LLM[]>([])
  const [availableLocalModels, setAvailableLocalModels] = useState<LLM[]>([])
  const [availableOpenRouterModels, setAvailableOpenRouterModels] = useState<
    OpenRouterLLM[]
  >([])

  // WORKSPACE STORE
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<Tables<"workspaces"> | null>(null)
  const [workspaceImages, setWorkspaceImages] = useState<WorkspaceImage[]>([])

  // PRESET STORE
  const [selectedPreset, setSelectedPreset] =
    useState<Tables<"presets"> | null>(null)

  // ASSISTANT STORE
  const [selectedAssistant, setSelectedAssistant] =
    useState<Tables<"assistants"> | null>(null)
  const [assistantImages, setAssistantImages] = useState<AssistantImage[]>([])
  const [openaiAssistants, setOpenaiAssistants] = useState<any[]>([])

  // PASSIVE CHAT STORE
  const [userInput, setUserInput] = useState<string>("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatSettings, setChatSettings] = useState<ChatSettings>({
    model: "gpt-4o",
    prompt: "You are a helpful AI assistant. your name is rhyno",
    temperature: 0.5,
    contextLength: 4000,
    includeProfileContext: true,
    includeWorkspaceInstructions: true,
    embeddingsProvider: "openai"
  })
  const [selectedChat, setSelectedChat] = useState<Tables<"chats"> | null>(null)
  const [chatFileItems, setChatFileItems] = useState<Tables<"file_items">[]>([])

  // ACTIVE CHAT STORE
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [firstTokenReceived, setFirstTokenReceived] = useState<boolean>(false)
  const [abortController, setAbortController] =
    useState<AbortController | null>(null)

  // CHAT INPUT COMMAND STORE
  const [isPromptPickerOpen, setIsPromptPickerOpen] = useState(false)
  const [slashCommand, setSlashCommand] = useState("")
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false)
  const [hashtagCommand, setHashtagCommand] = useState("")
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false)
  const [toolCommand, setToolCommand] = useState("")
  const [focusPrompt, setFocusPrompt] = useState(false)
  const [focusFile, setFocusFile] = useState(false)
  const [focusTool, setFocusTool] = useState(false)
  const [focusAssistant, setFocusAssistant] = useState(false)
  const [atCommand, setAtCommand] = useState("")
  const [isAssistantPickerOpen, setIsAssistantPickerOpen] = useState(false)

  // ATTACHMENTS STORE
  const [chatFiles, setChatFiles] = useState<ChatFile[]>([])
  const [chatImages, setChatImages] = useState<MessageImage[]>([])
  const [newMessageFiles, setNewMessageFiles] = useState<ChatFile[]>([])
  const [newMessageImages, setNewMessageImages] = useState<MessageImage[]>([])
  const [showFilesDisplay, setShowFilesDisplay] = useState<boolean>(false)

  // RETRIEVAL STORE
  const [useRetrieval, setUseRetrieval] = useState<boolean>(true)
  const [sourceCount, setSourceCount] = useState<number>(4)

  // TOOL STORE
  const [selectedTools, setSelectedTools] = useState<Tables<"tools">[]>([])
  const [toolInUse, setToolInUse] = useState<string>("none")
  const [isSpeechPlaying, setIsSpeechPlaying] = useState<boolean>(false)
  const [modelVolume, setModelVolume] = useState<number>(0)
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0)

  const fetchStartingData = async () => {
    const session = (await supabase.auth.getSession()).data.session
    if (session) {
      const user = session.user
      const profile = await getProfileByUserId(user.id)
      setProfile(profile)
      if (!profile.has_onboarded) {
        return router.push("/setup")
      }
      const workspaces = await getWorkspacesByUserId(user.id)
      setWorkspaces(workspaces)
      for (const workspace of workspaces) {
        let workspaceImageUrl = ""
        if (workspace.image_path) {
          workspaceImageUrl =
            (await getWorkspaceImageFromStorage(workspace.image_path)) || ""
        }
        if (workspaceImageUrl) {
          const response = await fetch(workspaceImageUrl)
          const blob = await response.blob()
          const base64 = await convertBlobToBase64(blob)
          setWorkspaceImages(prev => [
            ...prev,
            {
              workspaceId: workspace.id,
              path: workspace.image_path,
              base64: base64,
              url: workspaceImageUrl
            }
          ])
        }
      }
      return profile
    }
  }

  useEffect(() => {
    const initData = async () => {
      // اگر قبلاً لود شده، دوباره اجرا نکن
      if (hasInitialized.current) return

      const profileData = await fetchStartingData()

      if (profileData) {
        hasInitialized.current = true // علامت‌گذاری که لود انجام شد

        const hostedModelRes = await fetchHostedModels(profileData)
        if (!hostedModelRes) return
        setEnvKeyMap(hostedModelRes.envKeyMap)
        setAvailableHostedModels(hostedModelRes.hostedModels)
        if (
          profileData["openrouter_api_key"] ||
          hostedModelRes.envKeyMap["openrouter"]
        ) {
          const openRouterModels = await fetchOpenRouterModels()
          if (!openRouterModels) return
          setAvailableOpenRouterModels(openRouterModels)
        }
      }
    }

    initData()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      // فقط اگر ساین‌این شد و هنوز دیتا نداریم، اجرا کن
      if (event === "SIGNED_IN" && !hasInitialized.current) {
        initData()
      } else if (event === "SIGNED_OUT") {
        hasInitialized.current = false
        setProfile(null)
        setWorkspaces([])
        router.push("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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
      envKeyMap,
      setEnvKeyMap,
      availableHostedModels,
      setAvailableHostedModels,
      availableLocalModels,
      setAvailableLocalModels,
      availableOpenRouterModels,
      setAvailableOpenRouterModels,
      selectedWorkspace,
      setSelectedWorkspace,
      workspaceImages,
      setWorkspaceImages,
      selectedPreset,
      setSelectedPreset,
      selectedAssistant,
      setSelectedAssistant,
      assistantImages,
      setAssistantImages,
      openaiAssistants,
      setOpenaiAssistants,
      userInput,
      setUserInput,
      chatMessages,
      setChatMessages,
      chatSettings,
      setChatSettings,
      selectedChat,
      setSelectedChat,
      chatFileItems,
      setChatFileItems,
      isGenerating,
      setIsGenerating,
      firstTokenReceived,
      setFirstTokenReceived,
      abortController,
      setAbortController,
      isPromptPickerOpen,
      setIsPromptPickerOpen,
      slashCommand,
      setSlashCommand,
      isFilePickerOpen,
      setIsFilePickerOpen,
      hashtagCommand,
      setHashtagCommand,
      isToolPickerOpen,
      setIsToolPickerOpen,
      toolCommand,
      setToolCommand,
      focusPrompt,
      setFocusPrompt,
      focusFile,
      setFocusFile,
      focusTool,
      setFocusTool,
      focusAssistant,
      setFocusAssistant,
      atCommand,
      setAtCommand,
      isAssistantPickerOpen,
      setIsAssistantPickerOpen,
      chatFiles,
      setChatFiles,
      chatImages,
      setChatImages,
      newMessageFiles,
      setNewMessageFiles,
      newMessageImages,
      setNewMessageImages,
      showFilesDisplay,
      setShowFilesDisplay,
      useRetrieval,
      setUseRetrieval,
      sourceCount,
      setSourceCount,
      selectedTools,
      setSelectedTools,
      toolInUse,
      setToolInUse,
      isSpeechPlaying,
      setIsSpeechPlaying,
      modelVolume,
      setModelVolume,
      audioCurrentTime,
      setAudioCurrentTime
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
      envKeyMap,
      availableHostedModels,
      availableLocalModels,
      availableOpenRouterModels,
      selectedWorkspace,
      workspaceImages,
      selectedPreset,
      selectedAssistant,
      assistantImages,
      openaiAssistants,
      userInput,
      chatMessages,
      chatSettings,
      selectedChat,
      chatFileItems,
      isGenerating,
      firstTokenReceived,
      abortController,
      isPromptPickerOpen,
      slashCommand,
      isFilePickerOpen,
      hashtagCommand,
      isToolPickerOpen,
      toolCommand,
      focusPrompt,
      focusFile,
      focusTool,
      focusAssistant,
      atCommand,
      isAssistantPickerOpen,
      chatFiles,
      chatImages,
      newMessageFiles,
      newMessageImages,
      showFilesDisplay,
      useRetrieval,
      sourceCount,
      selectedTools,
      toolInUse,
      isSpeechPlaying,
      setIsSpeechPlaying,
      modelVolume,
      setModelVolume,
      audioCurrentTime,
      setAudioCurrentTime
    ]
  )

  return (
    <ChatbotUIContext.Provider value={contextValue}>
      {children}
    </ChatbotUIContext.Provider>
  )
}
