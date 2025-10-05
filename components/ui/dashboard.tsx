"use client"

import { FC, useState, useEffect } from "react"
import dynamic from "next/dynamic" // ✨ dynamic را import کنید
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { IconChevronCompactRight } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Tabs } from "@/components/ui/tabs"
import { SidebarSwitcher } from "@/components/sidebar/sidebar-switcher"
import { useSelectFileHandler } from "../chat/chat-hooks/use-select-file-handler"

import useHotkey from "@/lib/hooks/use-hotkey"
import { cn } from "@/lib/utils"
import { ContentType } from "@/types"
import { Skeleton } from "@/components/ui/skeleton" // ✨ برای نمایش حالت لودینگ

export const SIDEBAR_WIDTH = 350

// ✨ ۱. کامپوننت‌های سنگین را به صورت دینامیک وارد کنید
const Sidebar = dynamic(
  () => import("@/components/sidebar/sidebar").then(mod => mod.Sidebar),
  {
    // در حین لود شدن سایدبار، یک اسکلت ساده نمایش می‌دهیم
    loading: () => <SidebarSkeleton />
  }
)

const CommandK = dynamic(
  () => import("../utility/command-k").then(mod => mod.CommandK),
  { ssr: false } // کامپوننت CommandK نیازی به رندر سمت سرور ندارد
)

interface DashboardProps {
  children: React.ReactNode
}

export const Dashboard: FC<DashboardProps> = ({ children }) => {
  useHotkey("s", () => handleToggleSidebar())

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabValue = searchParams.get("tab") || "chats"

  const { handleSelectFile } = useSelectFileHandler()

  const [contentType, setContentType] = useState<ContentType>(
    tabValue as ContentType
  )
  const [showSidebar, setShowSidebar] = useState(true) // ✨ مقدار اولیه ثابت
  const [isInitialized, setIsInitialized] = useState(false) // ✨ برای جلوگیری از FOUC
  const [isDragging, setIsDragging] = useState(false)

  // ✨ ۲. مشکل localStorage را حل کنید
  // برای جلوگیری از خطای Hydration، مقدار localStorage را فقط در سمت کلاینت می‌خوانیم
  useEffect(() => {
    const storedShowSidebar = localStorage.getItem("showSidebar")
    setShowSidebar(storedShowSidebar === "true")
    setIsInitialized(true)
  }, [])

  const handleToggleSidebar = () => {
    const newState = !showSidebar
    setShowSidebar(newState)
    localStorage.setItem("showSidebar", String(newState))
  }

  // توابع مربوط به Drag & Drop بدون تغییر
  const onFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    handleSelectFile(files[0])
    setIsDragging(false)
  }
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
  }
  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  // ✨ از isInitialized استفاده می‌کنیم تا از پرش UI جلوگیری شود
  if (!isInitialized) {
    return null // یا یک کامپوننت Loading تمام صفحه
  }

  return (
    <div className="flex size-full">
      <CommandK />

      {/* بخش سایدبار */}
      <div
        className={cn(
          "duration-200 dark:border-none",
          // ✅ اصلاح ۱: حاشیه سایدبار منطقی شد
          showSidebar ? "ltr:border-r-2 rtl:border-l-2" : ""
        )}
        style={{
          minWidth: showSidebar ? `${SIDEBAR_WIDTH}px` : "0px",
          maxWidth: showSidebar ? `${SIDEBAR_WIDTH}px` : "0px",
          width: showSidebar ? `${SIDEBAR_WIDTH}px` : "0px"
        }}
      >
        {showSidebar && (
          <Tabs
            className="flex h-full"
            value={contentType}
            onValueChange={tabValue => {
              setContentType(tabValue as ContentType)
              router.replace(`${pathname}?tab=${tabValue}`)
            }}
          >
            <SidebarSwitcher onContentTypeChange={setContentType} />
            <Sidebar contentType={contentType} showSidebar={showSidebar} />
          </Tabs>
        )}
      </div>

      {/* بخش محتوای اصلی */}
      <div
        className="bg-muted/50 relative flex w-screen min-w-[90%] grow flex-col sm:min-w-fit"
        onDrop={onFileDrop}
        onDragOver={onDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {isDragging ? (
          <div className="flex h-full items-center justify-center bg-black/50 text-2xl text-white">
            drop file here
          </div>
        ) : (
          children
        )}

        {/* ✅ دکمه اصلاح شده */}
        <Button
          className={cn(
            "absolute top-[50%] z-10 size-[32px] cursor-pointer transition-transform duration-200",
            // ✅ اصلاح ۲: موقعیت دکمه منطقی شد
            "start-[4px]",
            // ✅ اصلاح ۳: چرخش آیکون برای RTL و LTR منطقی شد
            showSidebar
              ? "ltr:rotate-180 rtl:rotate-0"
              : "ltr:rotate-0 rtl:rotate-180"
          )}
          // style prop حذف شد چون منطق آن به className منتقل شد
          variant="ghost"
          size="icon"
          onClick={handleToggleSidebar}
        >
          <IconChevronCompactRight size={24} />
        </Button>
      </div>
    </div>
  )
}

// یک کامپوننت ساده برای نمایش حالت لودینگ سایدبار
const SidebarSkeleton = () => {
  return (
    <div className="flex h-full flex-col p-4">
      <Skeleton className="h-[36px] w-[120px]" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  )
}
