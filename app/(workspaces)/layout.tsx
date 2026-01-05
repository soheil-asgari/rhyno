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
import { ChatMessage } from "@/types"
import { ReactNode, useContext, useEffect, useState } from "react"
import Loading from "../loading"
import dynamic from "next/dynamic"
import { useParams, useRouter, notFound } from "next/navigation"
import { getChatById } from "@/db/chats"
import { getMessagesByChatId } from "@/db/messages"
import { Tables } from "@/supabase/types"
import { toast } from "sonner" // اضافه کردن Toast برای نمایش خطا

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

  const workspaceid = params.workspaceid as string
  const chatId = params.chatId as string | undefined

  const context = useContext(ChatbotUIContext)
  if (!context) {
    throw new Error("useContext must be used within a ChatbotUIProvider")
  }

  const {
    workspaces,
    setAssistants,
    setChats,
    setCollections,
    setFolders,
    setFiles,
    setModels,
    setPresets,
    setPrompts,
    setTools,
    setSelectedWorkspace,
    setSelectedChat,
    setChatMessages
  } = context

  const [loading, setLoading] = useState(true)
  const [isValidWorkspace, setIsValidWorkspace] = useState(false)

  useEffect(() => {
    const validateAndFetchData = async () => {
      try {
        if (!workspaceid) {
          setIsValidWorkspace(false)
          setLoading(false)
          return
        }

        // 1. پیدا کردن ورک‌اسپیس
        let workspace: Tables<"workspaces"> | null = null

        if (workspaces.length > 0) {
          workspace = workspaces.find(w => w.id === workspaceid) || null
        }

        if (!workspace) {
          workspace = await getWorkspaceById(workspaceid)
        }

        if (!workspace) {
          setIsValidWorkspace(false)
          setLoading(false)
          return
        }

        setSelectedWorkspace(workspace)
        setIsValidWorkspace(true)

        // 2. دریافت سایر اطلاعات
        const [
          assistants,
          chats,
          collections,
          folders,
          files,
          presets,
          prompts,
          tools,
          models
        ] = await Promise.all([
          getAssistantWorkspacesByWorkspaceId(workspaceid),
          getChatsByWorkspaceId(workspaceid),
          getCollectionWorkspacesByWorkspaceId(workspaceid),
          getFoldersByWorkspaceId(workspaceid),
          getFileWorkspacesByWorkspaceId(workspaceid),
          getPresetWorkspacesByWorkspaceId(workspaceid),
          getPromptWorkspacesByWorkspaceId(workspaceid),
          getToolWorkspacesByWorkspaceId(workspaceid),
          getModelWorkspacesByWorkspaceId(workspaceid)
        ])

        setAssistants(assistants.assistants || [])
        setChats(chats || [])
        setCollections(collections.collections || [])
        setFolders(folders || [])
        setFiles(files.files || [])
        setPresets(presets.presets || [])
        setPrompts(prompts.prompts || [])
        setTools(tools.tools || [])
        setModels(models.models || [])
      } catch (error) {
        console.error("Error loading workspace data:", error)
        toast.error("خطا در بارگذاری اطلاعات ورک‌اسپیس")
      } finally {
        // این خط تضمین می‌کند که حتی در صورت خطا، لودینگ تمام شود
        setLoading(false)
      }
    }

    validateAndFetchData()
  }, [workspaceid])

  useEffect(() => {
    if (!loading && !isValidWorkspace) {
      router.push("/setup")
    }
  }, [loading, isValidWorkspace, router])

  useEffect(() => {
    const fetchChatMessages = async () => {
      if (!chatId || !isValidWorkspace) {
        setSelectedChat(null)
        setChatMessages([])
        return
      }

      try {
        const chat = await getChatById(chatId)
        if (!chat) {
          setSelectedChat(null)
          return
        }

        const messages = await getMessagesByChatId(chatId)
        const formattedMessages: ChatMessage[] = messages.map(msg => ({
          message: msg,
          fileItems: []
        }))

        setSelectedChat(chat)
        setChatMessages(formattedMessages)
      } catch (error) {
        console.error("Error fetching chat messages:", error)
      }
    }

    if (!loading && isValidWorkspace) {
      fetchChatMessages()
    }
  }, [chatId, isValidWorkspace, loading])

  if (loading) {
    return <Loading />
  }

  if (!isValidWorkspace) {
    return <Loading />
  }

  return <Dashboard>{children}</Dashboard>
}
