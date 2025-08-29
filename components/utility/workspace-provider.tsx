// مسیر جدید: components/utility/workspace-provider.tsx

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
import { LLMID } from "@/types"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ReactNode, useContext, useEffect, useState } from "react"
import Loading from "@/app/loading"

interface WorkspaceProviderProps {
  children: ReactNode
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const workspaceId = params.workspaceid as string

  const {
    setChatSettings,
    setAssistants,
    setChats,
    setCollections,
    setFolders,
    setFiles,
    setPresets,
    setPrompts,
    setTools,
    setModels,
    setSelectedWorkspace
  } = useContext(ChatbotUIContext)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initialize = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (!session) {
        return router.push("/login")
      }

      if (workspaceId) {
        setLoading(true)
        await fetchWorkspaceData(workspaceId)
        setLoading(false)
      } else {
        setLoading(false)
      }
    }

    initialize()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") {
        router.push("/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [workspaceId])

  const fetchWorkspaceData = async (workspaceId: string) => {
    try {
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

      if (workspace) {
        setChatSettings({
          model: (searchParams.get("model") ||
            workspace.default_model ||
            "gpt-4-1106-preview") as LLMID,
          prompt:
            workspace.default_prompt ||
            "You are a friendly, helpful AI assistant.",
          temperature: workspace.default_temperature || 0.5,
          contextLength: workspace.default_context_length || 4096,
          includeProfileContext: workspace.include_profile_context || true,
          includeWorkspaceInstructions:
            workspace.include_workspace_instructions || true,
          embeddingsProvider:
            (workspace.embeddings_provider as "openai" | "local") || "openai"
        })
      }
    } catch (error) {
      console.error("Error fetching workspace data:", error)
    }
  }

  if (loading) {
    return <Loading />
  }

  return <>{children}</>
}
