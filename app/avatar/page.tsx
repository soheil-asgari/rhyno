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

// رفع ارور تایپ با استفاده از any برای سریع‌تر شدن کار (بعداً میتوانید دقیق کنید)
const REALTIME_MODEL_ID = "gpt-realtime-mini"

export default function AvatarPage() {
  // 1. گرفتن کل کانتکست در دنیای بیرون
  const contextValue = useContext(ChatbotUIContext)
  const { chatSettings, setChatSettings } = contextValue

  const [isModelReady, setIsModelReady] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()
  const params = useParams()

  // هندل کردن پارامتر که ممکن است undefined باشد
  const workspaceid = params ? params.workspaceid : null

  const defaultSettings: any = {
    model: REALTIME_MODEL_ID,
    prompt: "You are a helpful AI assistant.",
    temperature: 0.5,
    contextLength: 4096,
    includeProfileContext: true,
    includeWorkspaceInstructions: true,
    embeddingsProvider: "openai"
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
      setChatSettings((prev: any) => ({ ...prev, model: REALTIME_MODEL_ID }))
      setIsModelReady(true)
    }
  }, [chatSettings, setChatSettings])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)
  const activeSettings = chatSettings || defaultSettings

  if (!isModelReady && !chatSettings) return <Spinner />

  return (
    <>
      <div className="font-vazir fixed right-4 top-4 z-[999]">
        <button
          type="button"
          onClick={toggleMenu}
          aria-label="Settings" // رفع ارور دکمه
          title="Settings"
          className="rounded-full bg-black/50 p-2 text-white hover:bg-black/75"
        >
          <Settings size={24} />
        </button>
        {isMenuOpen && (
          <div
            className="absolute right-0 top-full mt-2 flex w-56 flex-col gap-1 rounded-lg bg-gray-800/90 p-2 text-white shadow-xl backdrop-blur-sm"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() =>
                router.push(workspaceid ? `/${workspaceid}/chat` : "/")
              }
              className="flex w-full items-center gap-3 rounded-md p-2 text-right hover:bg-gray-700/80"
            >
              <MessageCircle size={18} />
              <span>بازگشت به چت</span>
            </button>
            <button
              onClick={() => router.push("/")}
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
              <span>خروج</span>
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
        {/* ✅✅✅ پل حیاتی: اینجا کانتکست را دوباره به داخل تزریق می‌کنیم ✅✅✅ */}
        <ChatbotUIContext.Provider value={contextValue}>
          <Suspense fallback={null}>
            <Experience />
            <Preload all />
          </Suspense>
        </ChatbotUIContext.Provider>
      </Canvas>
      <Loader containerStyles={{ zIndex: 20 }} />
    </>
  )
}
