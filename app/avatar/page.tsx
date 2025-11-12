// مسیر: rhyno/app/(workspaces)/[workspaceid]/avatar/page.tsx
"use client"
import { Canvas } from "@react-three/fiber"
import { Loader, Preload } from "@react-three/drei"
import { Suspense, useContext, useEffect, useState } from "react"
import { ChatbotUIContext } from "@/context/context"
import { Experience } from "@/components/chat/Experience.jsx"

// ❗️❗️❗️ ۱. ایمپورت کردن کامپوننت جدید آواتار
import { AvatarVoiceUI } from "@/components/chat/avatar-voice-ui" // ❗️ مسیر را چک کنید
import Spinner from "@/app/(workspaces)/[workspaceid]/chat/spinner"

const REALTIME_MODEL_ID = "gpt-realtime-mini"

export default function AvatarPage() {
  const { chatSettings, setChatSettings } = useContext(ChatbotUIContext)
  const [isModelReady, setIsModelReady] = useState(false)

  useEffect(() => {
    if (!chatSettings || !setChatSettings) {
      return
    }
    const currentModel = chatSettings?.model || ""
    if (currentModel.includes("realtime")) {
      setIsModelReady(true)
    } else {
      setChatSettings(prevSettings => ({
        ...prevSettings,
        model: REALTIME_MODEL_ID
      }))
    }
  }, [chatSettings, setChatSettings])

  if (!isModelReady || !chatSettings) {
    return <Spinner />
  }

  return (
    <>
      {/* ❗️❗️❗️ ۲. استفاده از کامپوننت جدید و پاس دادن Prop */}
      <AvatarVoiceUI chatSettings={chatSettings} />

      <Canvas shadows camera={{ position: [0, 0, 1], fov: 30 }}>
        <Suspense fallback={null}>
          <Experience />
          <Preload all />
        </Suspense>
      </Canvas>
      <Loader />
    </>
  )
}
