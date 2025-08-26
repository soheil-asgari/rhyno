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
import { LLMID } from "@/types"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ReactNode, useContext, useEffect, useState } from "react"
import Loading from "../loading"
import dynamic from "next/dynamic"

const Dashboard = dynamic(
  () => import("@/components/ui/dashboard").then(mod => mod.Dashboard),
  {
    ssr: false, // چون Dashboard به احتمال زیاد به context و state وابسته است
    loading: () => <Loading /> // در حین لود شدن داشبورد، کامپوننت لودینگ را نشان بده
  }
)
// این کامپوننت نیازی به dynamic import ندارد مگر اینکه دلیل خاصی داشته باشید
// import dynamic from "next/dynamic"

interface WorkspaceLayoutProps {
  children: ReactNode
}

const RESERVED_ROUTES = ["chat", "settings", "profile"]

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  // استخراج و اعتبارسنجی workspaceId ساده‌تر شده است
  const workspaceId = Array.isArray(params.workspaceid)
    ? params.workspaceid[0]
    : params.workspaceid

  if (!workspaceId) {
    // در Next.js 13+ بهتر است از notFound() استفاده کنید یا یک Error Boundary داشته باشید
    throw new Error("Workspace ID is missing")
  }

  if (
    !RESERVED_ROUTES.includes(workspaceId) &&
    !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      workspaceId
    )
  ) {
    throw new Error(`Invalid workspace ID: ${workspaceId}`)
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
    setChatMessages,
    setUserInput,
    setIsGenerating,
    setFirstTokenReceived,
    setChatFiles,
    setChatImages,
    setNewMessageFiles,
    setNewMessageImages,
    setShowFilesDisplay
  } = useContext(ChatbotUIContext)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ریست کردن state چت هنگام تغییر workspaceId
    setUserInput("")
    setChatMessages([])
    setSelectedChat(null)
    setIsGenerating(false)
    setFirstTokenReceived(false)
    setChatFiles([])
    setChatImages([])
    setNewMessageFiles([])
    setNewMessageImages([])
    setShowFilesDisplay(false)

    // بررسی session و بارگذاری داده‌ها
    const checkSessionAndFetchData = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session) {
        // اگر session وجود نداشت، کاربر لاگین نکرده و نیازی به ادامه نیست
        setLoading(false) // لودینگ را متوقف کن
        return
      }

      if (workspaceId) {
        await fetchWorkspaceData(workspaceId)
      }
    }

    checkSessionAndFetchData()
  }, [workspaceId]) // این useEffect فقط به workspaceId وابسته است

  const fetchWorkspaceData = async (workspaceId: string) => {
    setLoading(true)

    if (RESERVED_ROUTES.includes(workspaceId)) {
      setSelectedWorkspace(null)
      setAssistants([])
      setAssistantImages([])
      // بقیه state ها را هم خالی کن
      setChats([])
      setCollections([])
      setFolders([])
      // ...
      setLoading(false)
      return
    }

    try {
      // ✅ اجرای همزمان تمام درخواست‌های اصلی با Promise.all
      const [
        workspace,
        assistantData,
        chats,
        collectionData,
        folders,
        fileData,
        presetData,
        promptData,
        toolData,
        modelData
      ] = await Promise.all([
        getWorkspaceById(workspaceId),
        getAssistantWorkspacesByWorkspaceId(workspaceId),
        getChatsByWorkspaceId(workspaceId),
        getCollectionWorkspacesByWorkspaceId(workspaceId),
        getFoldersByWorkspaceId(workspaceId),
        getFileWorkspacesByWorkspaceId(workspaceId),
        getPresetWorkspacesByWorkspaceId(workspaceId),
        getPromptWorkspacesByWorkspaceId(workspaceId),
        getToolWorkspacesByWorkspaceId(workspaceId),
        getModelWorkspacesByWorkspaceId(workspaceId)
      ])

      // تنظیم state ها بعد از دریافت تمام داده‌ها
      setSelectedWorkspace(workspace)
      setAssistants(assistantData.assistants)
      setChats(chats)
      setCollections(collectionData.collections)
      setFolders(folders)
      setFiles(fileData.files)
      setPresets(presetData.presets)
      setPrompts(promptData.prompts)
      setTools(toolData.tools)
      setModels(modelData.models)

      // ✅ بهینه‌سازی پردازش تصاویر
      if (assistantData.assistants.length > 0) {
        const imagePromises = assistantData.assistants.map(async assistant => {
          if (!assistant.image_path) {
            return {
              assistantId: assistant.id,
              path: "",
              base64: "",
              url: ""
            }
          }
          const url =
            (await getAssistantImageFromStorage(assistant.image_path)) || ""
          if (!url) {
            return {
              assistantId: assistant.id,
              path: assistant.image_path,
              base64: "",
              url: ""
            }
          }
          const response = await fetch(url)
          const blob = await response.blob()
          const base64 = await convertBlobToBase64(blob)
          return {
            assistantId: assistant.id,
            path: assistant.image_path,
            base64,
            url
          }
        })
        const assistantImages = await Promise.all(imagePromises)
        setAssistantImages(assistantImages)
      } else {
        setAssistantImages([])
      }

      // تنظیمات چت
      setChatSettings({
        model: (searchParams.get("model") ||
          workspace?.default_model ||
          "gpt-4-1106-preview") as LLMID,
        prompt:
          workspace?.default_prompt ||
          "You are a friendly, helpful AI assistant. your name is Rhyno",
        temperature: workspace?.default_temperature || 0.5,
        contextLength: workspace?.default_context_length || 4096,
        includeProfileContext: workspace?.include_profile_context || true,
        includeWorkspaceInstructions:
          workspace?.include_workspace_instructions || true,
        embeddingsProvider:
          (workspace?.embeddings_provider as "openai" | "local") || "openai"
      })
    } catch (error) {
      console.error("Failed to fetch workspace data:", error)
      // در اینجا می‌توانید یک state برای خطا تعریف کرده و به کاربر نمایش دهید
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Loading />
  }

  return <Dashboard>{children}</Dashboard>
}
