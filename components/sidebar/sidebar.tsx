"use client"

import { ChatbotUIContext } from "@/context/context"
import { ContentType } from "@/types"
import { FC, useContext, useMemo } from "react" // ✨ useState حذف شد
import dynamic from "next/dynamic"

import { SIDEBAR_WIDTH } from "../ui/dashboard"
import { TabsContent } from "../ui/tabs"
import { WorkspaceSwitcher } from "../utility/workspace-switcher"
import { Skeleton } from "../ui/skeleton"

// کامپوننت‌های سنگین همچنان به صورت دینامیک وارد می‌شوند
const SidebarContent = dynamic(
  () => import("./sidebar-content").then(mod => mod.SidebarContent),
  {
    loading: () => <SidebarContentSkeleton />
  }
)

const WorkspaceSettings = dynamic(() =>
  import("../workspace/workspace-settings").then(mod => mod.WorkspaceSettings)
)

interface SidebarProps {
  contentType: ContentType
  showSidebar: boolean
}

export const Sidebar: FC<SidebarProps> = ({ contentType, showSidebar }) => {
  const { folders, ...dataSources } = useContext(ChatbotUIContext)

  // ✨ تمام منطق و state مربوط به showWorkspaceSettings حذف شد

  // فیلتر کردن فولدرها با useMemo برای عملکرد بهتر
  const chatFolders = useMemo(
    () => folders.filter(f => f.type === "chats"),
    [folders]
  )
  const presetFolders = useMemo(
    () => folders.filter(f => f.type === "presets"),
    [folders]
  )
  const promptFolders = useMemo(
    () => folders.filter(f => f.type === "prompts"),
    [folders]
  )
  const filesFolders = useMemo(
    () => folders.filter(f => f.type === "files"),
    [folders]
  )
  const collectionFolders = useMemo(
    () => folders.filter(f => f.type === "collections"),
    [folders]
  )
  const assistantFolders = useMemo(
    () => folders.filter(f => f.type === "assistants"),
    [folders]
  )
  const toolFolders = useMemo(
    () => folders.filter(f => f.type === "tools"),
    [folders]
  )
  const modelFolders = useMemo(
    () => folders.filter(f => f.type === "models"),
    [folders]
  )

  const contentTypeDetails = useMemo(
    () => ({
      chats: { data: dataSources.chats, folders: chatFolders },
      presets: { data: dataSources.presets, folders: presetFolders },
      prompts: { data: dataSources.prompts, folders: promptFolders },
      files: { data: dataSources.files, folders: filesFolders },
      collections: {
        data: dataSources.collections,
        folders: collectionFolders
      },
      assistants: { data: dataSources.assistants, folders: assistantFolders },
      tools: { data: dataSources.tools, folders: toolFolders },
      models: { data: dataSources.models, folders: modelFolders }
    }),
    [
      dataSources,
      chatFolders,
      presetFolders,
      promptFolders,
      filesFolders,
      collectionFolders,
      assistantFolders,
      toolFolders,
      modelFolders
    ]
  ) // ✨ آرایه وابستگی کامل شد

  return (
    <TabsContent
      className="m-0 w-full space-y-2"
      style={{
        minWidth: showSidebar ? `calc(${SIDEBAR_WIDTH}px - 60px)` : "0px",
        maxWidth: showSidebar ? `calc(${SIDEBAR_WIDTH}px - 60px)` : "0px",
        width: showSidebar ? `calc(${SIDEBAR_WIDTH}px - 60px)` : "0px"
      }}
      value={contentType}
    >
      <div className="flex h-full flex-col p-3">
        <div className="flex items-center border-b-2 pb-2">
          <WorkspaceSwitcher />

          {/* ✨ کامپوننت به سادگی و بدون هیچ پراپ یا state اضافی رندر می‌شود */}
          <WorkspaceSettings />
        </div>

        {contentType in contentTypeDetails && (
          <SidebarContent
            contentType={contentType}
            data={contentTypeDetails[contentType].data}
            folders={contentTypeDetails[contentType].folders}
          />
        )}
      </div>
    </TabsContent>
  )
}

const SidebarContentSkeleton = () => {
  return (
    <div className="mt-4 space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  )
}
