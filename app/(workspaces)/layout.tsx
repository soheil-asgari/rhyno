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

  // ✅ اصلاح شد: از نام‌گذاری استاندارد camelCase استفاده می‌کنیم
  // ‼️ توجه: مطمئن شوید نام پوشه‌های داینامیک شما [workspaceId] و [chatId] باشد
  const workspaceid = params.workspaceid as string
  const chatId = params.chatId as string | undefined

  const context = useContext(ChatbotUIContext)
  if (!context) {
    throw new Error("useContext must be used within a ChatbotUIProvider")
  }

  const {
    workspaces, // ✅ برای بهینه‌سازی، لیست workspaces را از کانتکست می‌خوانیم
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
      // اگر شناسه workspace از URL نیامده بود، آن را نامعتبر تلقی کن
      if (!workspaceid) {
        setIsValidWorkspace(false)
        setLoading(false)
        return
      }

      // ابتدا در لیستی که از قبل داریم جستجو کن
      let workspace: Tables<"workspaces"> | null | undefined

      // اگر در لیست نبود، از دیتابیس بپرس
      if (!workspace) {
        workspace = await getWorkspaceById(workspaceid)
      }

      // حالا کد بدون خطای تایپ‌اسکریپت کار می‌کند
      if (workspace) {
        setSelectedWorkspace(workspace)
        setIsValidWorkspace(true)
      } else {
        setIsValidWorkspace(false)
      }

      // ✅ اگر workspace پیدا شد، آن را معتبر علامت زده و در state قرار بده
      setIsValidWorkspace(true)
      setSelectedWorkspace(workspace)

      // حالا بقیه اطلاعات مربوط به این workspace معتبر را واکشی کن
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
    setTools
  ])

  useEffect(() => {
    // این useEffect مسئول هدایت کاربر در صورت نامعتبر بودن workspace است
    if (!loading && !isValidWorkspace) {
      router.push("/landing")
    }
  }, [loading, isValidWorkspace, router])

  useEffect(() => {
    // این useEffect مسئول واکشی پیام‌های یک چت خاص است
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

    // فقط در صورتی پیام‌ها را واکشی کن که در یک workspace معتبر باشیم
    if (isValidWorkspace) {
      fetchChatMessages()
    }
  }, [chatId, isValidWorkspace, setSelectedChat, setChatMessages])

  // تا زمانی که در حال بررسی هستیم یا workspace نامعتبر است و در حال هدایت شدن است، صفحه لودینگ را نمایش بده
  if (loading || !isValidWorkspace) {
    return <Loading />
  }

  // فقط اگر workspace معتبر بود، داشبورد و محتوای صفحه را نمایش بده
  return <Dashboard>{children}</Dashboard>
}
