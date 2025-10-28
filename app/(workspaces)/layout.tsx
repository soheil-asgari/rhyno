"use client"

import { ChatbotUIContext } from "@/context/context"
import { getAssistantWorkspacesByWorkspaceId } from "@/db/assistants"
import { getChatsByWorkspaceId } from "@/db/chats"
import { getCollectionWorkspacesByWorkspaceId } from "@/db/collections"
import { getFileWorkspacesByWorkspaceId } from "@/db/files"
import { getFoldersByWorkspaceId } from "@/db/folders"
import { getModelWorkspacesByWorkspaceId } from "@/db/models"
import { getPresetWorkspacesByWorkspaceId } from "@/db/presets"
import { getPromptWorkspacesByWorkspaceId } from "@/db/prompts"
import { getToolWorkspacesByWorkspaceId } from "@/db/tools"
import { getWorkspaceById } from "@/db/workspaces"
import { supabase } from "@/lib/supabase/browser-client"
import { ChatMessage } from "@/types"
import { ReactNode, useContext, useEffect, useState, useCallback } from "react"
import Loading from "../loading"
import dynamic from "next/dynamic"
import { useParams, useRouter, notFound } from "next/navigation"
import { getChatById } from "@/db/chats"
import { getMessagesByChatId } from "@/db/messages"
import { Tables, TablesUpdate } from "@/supabase/types"

const Dashboard = dynamic(
  () => import("@/components/ui/dashboard").then(mod => mod.Dashboard),
  { ssr: false }
)

interface WorkspaceLayoutProps {
  children: ReactNode
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const params = useParams()
  const router = useRouter()

  const {
    workspaces,
    setWorkspaces,
    setSelectedWorkspace,
    setAssistants,
    setChats,
    setCollections,
    setFolders,
    setFiles,
    setModels,
    setPresets,
    setPrompts,
    setTools,
    setSelectedChat,
    setChatMessages
  } = useContext(ChatbotUIContext)

  const [loading, setLoading] = useState(true)
  const [isValidWorkspace, setIsValidWorkspace] = useState(false)
  const workspaceid = params.workspaceid as string
  const chatId = params.chatid as string

  const fetchData = useCallback(async () => {
    const workspace = await getWorkspaceById(workspaceid)
    if (!workspace) {
      return setIsValidWorkspace(false)
    }

    setIsValidWorkspace(true)
    setSelectedWorkspace(workspace)

    const [
      assistants,
      chats,
      collections,
      folders,
      files,
      models,
      presets,
      prompts,
      tools
    ] = await Promise.all([
      getAssistantWorkspacesByWorkspaceId(workspaceid),
      getChatsByWorkspaceId(workspaceid),
      getCollectionWorkspacesByWorkspaceId(workspaceid),
      getFoldersByWorkspaceId(workspaceid),
      getFileWorkspacesByWorkspaceId(workspaceid),
      getModelWorkspacesByWorkspaceId(workspaceid),
      getPresetWorkspacesByWorkspaceId(workspaceid),
      getPromptWorkspacesByWorkspaceId(workspaceid),
      getToolWorkspacesByWorkspaceId(workspaceid)
    ])

    setAssistants(assistants.assistants)
    setChats(chats)
    setCollections(collections.collections)
    setFolders(folders)
    setFiles(files.files)
    setModels(models.models)
    setPresets(presets.presets)
    setPrompts(prompts.prompts)
    setTools(tools.tools)

    return true
  }, [
    workspaceid,
    setSelectedWorkspace,
    setAssistants,
    setChats,
    setCollections,
    setFolders,
    setFiles,
    setModels,
    setPresets,
    setPrompts,
    setTools
  ])

  useEffect(() => {
    if (!workspaces) return
    if (workspaces.length === 0) {
      return notFound()
    }

    fetchData().then(isValid => {
      setLoading(false)
      if (isValid) {
        setIsValidWorkspace(true)
      } else {
        setIsValidWorkspace(false)
      }
    })
  }, [
    workspaceid,
    workspaces,
    setSelectedWorkspace,
    setAssistants,
    setChats,
    setCollections,
    setFolders,
    setFiles,
    setModels,
    setPresets,
    setPrompts,
    setTools,
    fetchData
  ])

  useEffect(() => {
    if (!loading && !isValidWorkspace) {
      router.push("/")
    }
  }, [loading, isValidWorkspace, router])

  useEffect(() => {
    const fetchChatMessages = async () => {
      if (chatId) {
        const chat = await getChatById(chatId)
        if (!chat) return notFound()

        const messages = await getMessagesByChatId(chatId)
        const formattedMessages: ChatMessage[] = messages.map(msg => ({
          message: msg,
          fileItems: []
        }))
        setSelectedChat(chat)
        setChatMessages(formattedMessages)
      } else {
        setSelectedChat(null)
        setChatMessages([])
      }
    }

    if (isValidWorkspace) {
      fetchChatMessages()
    }
  }, [chatId, isValidWorkspace, setSelectedChat, setChatMessages])

  if (loading || !isValidWorkspace) {
    return <Loading />
  }

  return (
    <Dashboard>
      <div className="flex h-full">
        {/* 👇 ==== اصلاح اصلی اینجاست ==== 👇
          1. 'overflow-y-auto': به این div اسکرول داخلی می‌دهد.
          2. 'min-h-0': یک ترفند flexbox است که به 'overflow-y-auto' اجازه می‌دهد
             به درستی کار کند و از کش آمدن کانتینر جلوگیری می‌کند.
        */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </Dashboard>
  )
}
