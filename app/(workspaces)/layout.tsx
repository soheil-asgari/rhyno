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
import { getAssistantImageFromStorage } from "@/db/storage/assistant-images"
import { getToolWorkspacesByWorkspaceId } from "@/db/tools"
import { getWorkspaceById } from "@/db/workspaces"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import { supabase } from "@/lib/supabase/browser-client"
import { ChatMessage, LLMID } from "@/types"
import { useParams } from "next/navigation"
import { ReactNode, useContext, useEffect, useState, useCallback } from "react"
import Loading from "../loading"
import dynamic from "next/dynamic"

import { getChatById } from "@/db/chats"
import { getMessagesByChatId } from "@/db/messages"

const Dashboard = dynamic(
  () => import("@/components/ui/dashboard").then(mod => mod.Dashboard),
  { ssr: false }
)

interface WorkspaceLayoutProps {
  children: ReactNode
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const params = useParams()

  // ✨ اصلاح کلیدی: استفاده از نام پارامتر با حروف کوچک دقیقاً مطابق نام پوشه
  const workspaceId = params.workspaceid as string
  const chatId = params.chatid as string | undefined

  const context = useContext(ChatbotUIContext)
  if (!context) {
    throw new Error("useContext must be used within a ChatbotUIProvider")
  }

  const {
    setChatSettings,
    setAssistants,
    setAssistantImages,
    setChats,
    setCollections,
    setFolders,
    setFiles,
    setPresets,
    setPrompts,
    setTools,
    setModels,
    setSelectedWorkspace,
    setSelectedChat,
    setChatMessages
  } = context

  const [loading, setLoading] = useState(true)

  const fetchWorkspaceData = useCallback(async (id: string) => {
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) return

      const [
        workspace,
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
        getWorkspaceById(id),
        getAssistantWorkspacesByWorkspaceId(id),
        getChatsByWorkspaceId(id),
        getCollectionWorkspacesByWorkspaceId(id),
        getFoldersByWorkspaceId(id),
        getFileWorkspacesByWorkspaceId(id),
        getPresetWorkspacesByWorkspaceId(id),
        getPromptWorkspacesByWorkspaceId(id),
        getToolWorkspacesByWorkspaceId(id),
        getModelWorkspacesByWorkspaceId(id)
      ])

      if (!workspace) return // از کرش کردن جلوگیری می‌کند اگر ورک‌اسپیس پیدا نشود

      setSelectedWorkspace(workspace)
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
      console.error("Failed to fetch workspace data:", error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (workspaceId) {
      setLoading(true)
      fetchWorkspaceData(workspaceId).finally(() => setLoading(false))
    }
  }, [workspaceId, fetchWorkspaceData])

  useEffect(() => {
    const fetchChatMessages = async () => {
      if (chatId) {
        try {
          const chat = await getChatById(chatId)
          const dbMessages = await getMessagesByChatId(chatId)
          const formattedMessages: ChatMessage[] = dbMessages.map(
            dbMessage => ({ message: dbMessage, fileItems: [] })
          )
          setSelectedChat(chat)
          setChatMessages(formattedMessages)
        } catch (error) {
          console.error(`Failed to fetch messages for chat ${chatId}:`, error)
        }
      } else {
        setSelectedChat(null)
        setChatMessages([])
      }
    }
    fetchChatMessages()
  }, [chatId])

  if (loading) {
    return <Loading />
  }

  return <Dashboard>{children}</Dashboard>
}
