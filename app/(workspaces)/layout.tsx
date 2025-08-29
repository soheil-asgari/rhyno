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
import { useParams, useSearchParams } from "next/navigation"
import { ReactNode, useContext, useEffect, useState, useCallback } from "react"
import Loading from "../loading"
import dynamic from "next/dynamic"

const Dashboard = dynamic(
  () => import("@/components/ui/dashboard").then(mod => mod.Dashboard),
  { ssr: false, loading: () => <Loading /> }
)

interface WorkspaceLayoutProps {
  children: ReactNode
}

const RESERVED_ROUTES = ["chat", "settings", "profile"]

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const params = useParams()
  const searchParams = useSearchParams()
  const workspaceId = params.workspaceid as string

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
    setSelectedWorkspace
    // ... an assumption that all other setters are here from context
  } = context

  const [loading, setLoading] = useState(true)

  const fetchWorkspaceData = useCallback(
    async (id: string) => {
      setLoading(true)

      // Reset states here if needed, for example:
      setSelectedWorkspace(null)
      setAssistants([])

      if (RESERVED_ROUTES.includes(id)) {
        setLoading(false)
        return
      }

      const isUUID =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
          id
        )
      if (!isUUID) {
        console.error(`Invalid workspace ID: ${id}`)
        setLoading(false)
        return
      }

      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()
        if (!session) {
          setLoading(false)
          return
        }

        // Assuming your db functions are now type-safe and return predictable values
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

        if (!workspace) {
          throw new Error("Workspace not found.")
        }

        setSelectedWorkspace(workspace)
        setAssistants(assistants?.assistants || [])
        setChats(chats || [])
        setCollections(collections?.collections || [])
        setFolders(folders || [])
        setFiles(files?.files || [])
        setPresets(presets?.presets || [])
        setPrompts(prompts?.prompts || [])
        setTools(tools?.tools || [])
        setModels(models?.models || [])

        const assistantList = assistants?.assistants || []
        if (assistantList.length > 0) {
          const imagePromises = assistantList.map(async assistant => {
            if (!assistant.image_path) return null
            const url = await getAssistantImageFromStorage(assistant.image_path)
            if (!url) return null
            try {
              const response = await fetch(url)
              const blob = await response.blob()
              const base64 = await convertBlobToBase64(blob)
              return {
                assistantId: assistant.id,
                path: assistant.image_path,
                base64,
                url
              }
            } catch (error) {
              console.error("Error processing assistant image:", error)
              return null
            }
          })
          const assistantImages = (await Promise.all(imagePromises)).filter(
            Boolean
          )
          setAssistantImages(assistantImages as any) // Cast as any if type is complex
        }

        setChatSettings({
          model: (searchParams.get("model") ||
            workspace.default_model ||
            "gpt-4-1106-preview") as LLMID,
          prompt:
            workspace.default_prompt ||
            "You are a friendly, helpful AI assistant. your name is Rhyno",
          temperature: workspace.default_temperature || 0.5,
          contextLength: workspace.default_context_length || 4096,
          includeProfileContext: workspace.include_profile_context,
          includeWorkspaceInstructions:
            workspace.include_workspace_instructions,
          embeddingsProvider:
            (workspace.embeddings_provider as "openai" | "local") || "openai"
        })
      } catch (error) {
        console.error("Failed to fetch workspace data:", error)
      } finally {
        setLoading(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [searchParams /* include all 'set' functions from context here */]
  )

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceData(workspaceId)
    } else {
      setLoading(false)
    }
  }, [workspaceId, fetchWorkspaceData])

  if (loading) {
    return <Loading />
  }

  return <Dashboard>{children}</Dashboard>
}
