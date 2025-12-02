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

  // نام پارامتر باید دقیقاً با نام پوشه یکی باشد (مثلاً [workspaceid] یا [workspaceId])
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
      if (!workspaceid) {
        setIsValidWorkspace(false)
        setLoading(false)
        return
      }

      // 1. پیدا کردن ورک‌اسپیس
      let workspace: Tables<"workspaces"> | null = null

      // اگر ورک‌اسپیس‌ها قبلاً لود شده‌اند، داخل آن‌ها بگرد
      if (workspaces.length > 0) {
        workspace = workspaces.find(w => w.id === workspaceid) || null
      }

      // اگر پیدا نشد، از دیتابیس بگیر
      if (!workspace) {
        workspace = await getWorkspaceById(workspaceid)
      }

      // ❌ اصلاح مهم: اگر ورک‌اسپیس وجود نداشت، همینجا متوقف شو
      if (!workspace) {
        setIsValidWorkspace(false)
        setLoading(false)
        return
      }

      // ✅ اگر رسیدیم اینجا یعنی ورک‌اسپیس معتبر است
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

      setLoading(false)
    }

    validateAndFetchData()
  }, [workspaceid]) // وابستگی‌ها را کم کردم تا لوپ بی‌نهایت نخورید

  // ریدایرکت در صورت نامعتبر بودن
  useEffect(() => {
    if (!loading && !isValidWorkspace) {
      router.push("/setup") // بهتر است به setup بروید تا home، چون شاید ورک‌اسپیس ندارد
    }
  }, [loading, isValidWorkspace, router])

  // واکشی پیام‌های چت
  useEffect(() => {
    const fetchChatMessages = async () => {
      if (!chatId || !isValidWorkspace) {
        setSelectedChat(null)
        setChatMessages([])
        return
      }

      const chat = await getChatById(chatId)
      if (!chat) {
        // اگر چت پیدا نشد ولی ورک‌اسپیس معتبر بود، فقط چت را خالی کن (ریدایرکت نکن که اذیت نکنه)
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
    }

    if (!loading && isValidWorkspace) {
      fetchChatMessages()
    }
  }, [chatId, isValidWorkspace, loading])

  if (loading) {
    return <Loading />
  }

  if (!isValidWorkspace) {
    return <Loading /> // تا زمان ریدایرکت شدن چیزی نشان نده
  }

  return <Dashboard>{children}</Dashboard>
}
