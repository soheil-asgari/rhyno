"use client"

import { Canvas } from "@react-three/fiber"
import { Loader, Preload } from "@react-three/drei"
import { Suspense, useContext, useEffect, useState } from "react"
import { ChatbotUIContext } from "@/context/context"
import { Experience } from "@/components/chat/Experience.jsx"
import { AvatarVoiceUI } from "@/components/chat/avatar-voice-ui"
import Spinner from "@/app/(workspaces)/[workspaceid]/chat/spinner"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Settings, LogOut, Home, MessageCircle } from "lucide-react"

// ✅ ۱. ایمپورت کردن تایپ‌های مورد نیاز
import { ChatSettings } from "@/types/chat"
import { LLMID } from "@/types/llms"

const REALTIME_MODEL_ID = "gpt-realtime-mini"

export default function AvatarPage() {
  // دریافت کانتکست
  const contextValue = useContext(ChatbotUIContext)
  const { chatSettings, setChatSettings } = contextValue

  const [isModelReady, setIsModelReady] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const router = useRouter()
  const params = useParams()

  const workspaceid = params?.workspaceid as string

  // ✅ ۲. تعریف دقیق تایپ برای defaultSettings
  const defaultSettings: ChatSettings = {
    model: REALTIME_MODEL_ID as LLMID, // Cast کردن رشته به نوع LLMID
    prompt: "You are a helpful AI assistant.",
    temperature: 0.5,
    contextLength: 4096,
    includeProfileContext: true,
    includeWorkspaceInstructions: true,
    embeddingsProvider: "openai", // چون تایپ ChatSettings دادیم، این را به عنوان "openai" قبول می‌کند نه string
    enableWebSearch: false
  }

  useEffect(() => {
    if (!setChatSettings) return

    if (!chatSettings) {
      setChatSettings(defaultSettings)
      setIsModelReady(true)
      return
    }

    const currentModel = chatSettings.model || ""
    if (currentModel.includes("realtime")) {
      setIsModelReady(true)
    } else {
      // اینجا هم باید مطمئن شویم تایپ درست پاس داده می‌شود
      setChatSettings(prev => ({
        ...prev,
        model: REALTIME_MODEL_ID as LLMID
      }))
      // در رندر بعدی آماده می‌شود
    }
  }, [chatSettings, setChatSettings])

  // توابع منو
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const handleGoToChat = () => {
    const targetPath = workspaceid ? `/${workspaceid}/chat` : `/`
    router.push(targetPath)
  }

  const handleGoToHome = () => {
    router.push("/")
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  if (!isModelReady) {
    return <Spinner />
  }

  const activeSettings = chatSettings || defaultSettings

  return (
    <>
      {/* --- منوی شناور --- */}
      <div className="font-vazir fixed right-4 top-4 z-[999]">
        <button
          onClick={toggleMenu}
          className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/75"
          aria-label="تنظیمات"
        >
          <Settings size={24} />
        </button>

        {isMenuOpen && (
          <div
            className="absolute right-0 top-full mt-2 flex w-56 flex-col gap-1 rounded-lg bg-gray-800/90 p-2 text-white shadow-xl backdrop-blur-sm"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={handleGoToChat}
              className="flex w-full items-center gap-3 rounded-md p-2 text-right hover:bg-gray-700/80"
            >
              <MessageCircle size={18} />
              <span>بازگشت به چت</span>
            </button>
            <button
              onClick={handleGoToHome}
              className="flex w-full items-center gap-3 rounded-md p-2 text-right hover:bg-gray-700/80"
            >
              <Home size={18} />
              <span>صفحه اصلی</span>
            </button>
            <hr className="my-1 border-gray-600/50" />
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md p-2 text-right text-red-400 hover:bg-red-500/30"
            >
              <LogOut size={18} />
              <span>خروج از حساب</span>
            </button>
          </div>
        )}
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-[990]" onClick={toggleMenu} />
      )}

      <AvatarVoiceUI chatSettings={activeSettings} />

      <Canvas
        shadows
        camera={{ position: [0, 0, 1], fov: 30 }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 10
        }}
      >
        {/* تزریق کانتکست به داخل Canvas برای Avatar.jsx */}
        <ChatbotUIContext.Provider value={contextValue}>
          <Suspense fallback={null}>
            <Experience />
            <Preload all />
          </Suspense>
        </ChatbotUIContext.Provider>
      </Canvas>

      <Loader
        containerStyles={{
          zIndex: 20
        }}
      />
    </>
  )
}
