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
import { useParams, useRouter } from "next/navigation"
import { getChatById } from "@/db/chats"
import { getMessagesByChatId } from "@/db/messages"
import { Tables } from "@/supabase/types"
import { toast } from "sonner"

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
    profile, // ✅ اضافه شد: برای چک کردن وضعیت لاگین
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

  // 1. دریافت اطلاعات ورک‌اسپیس (فقط وقتی پروفایل لود شده باشد)
  useEffect(() => {
    const validateAndFetchData = async () => {
      // 🛑 اصلاح مهم: اگر پروفایل هنوز لود نشده، صبر کن و هیچ کاری نکن
      if (!profile) return

      try {
        setLoading(true)

        if (!workspaceid) {
          setIsValidWorkspace(false)
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
          return
        }

        setSelectedWorkspace(workspace)
        setIsValidWorkspace(true)

        // 2. دریافت سایر اطلاعات به صورت موازی
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
        setIsValidWorkspace(false)
      } finally {
        setLoading(false)
      }
    }

    validateAndFetchData()
  }, [workspaceid, profile]) // ✅ profile به وابستگی‌ها اضافه شد تا با تغییر آن، کد دوباره اجرا شود

  // 2. ریدایرکت فقط در صورتی که دیتای کاربر کامل لود شده باشد و ورک‌اسپیس نامعتبر باشد
  useEffect(() => {
    if (profile && !loading && !isValidWorkspace) {
      router.push("/setup")
    }
  }, [loading, isValidWorkspace, router, profile])

  // 3. لود پیام‌های چت
  useEffect(() => {
    const fetchChatMessages = async () => {
      if (!chatId || !isValidWorkspace || !profile) {
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

    if (!loading && isValidWorkspace && profile) {
      fetchChatMessages()
    }
  }, [chatId, isValidWorkspace, loading, profile])

  // 🛑 تا زمانی که پروفایل لود نشده یا دیتا در حال دریافت است، اسپینر را نشان بده
  if (!profile || loading) {
    return <Loading />
  }

  // اگر ورک‌اسپیس معتبر نیست (در حال ریدایرکت)، همچنان لودینگ نشان بده
  if (!isValidWorkspace) {
    return <Loading />
  }

  return <Dashboard>{children}</Dashboard>
}
