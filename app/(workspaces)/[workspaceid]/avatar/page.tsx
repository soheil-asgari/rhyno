// مسیر: rhyno/app/(workspaces)/[workspaceid]/avatar/page.tsx
"use client"
import { Canvas } from "@react-three/fiber"
import { Loader, Preload } from "@react-three/drei"
import { Suspense, useContext, useEffect, useState } from "react"
import { ChatbotUIContext } from "@/context/context"
import { Experience } from "@/components/chat/Experience.jsx"
import { AvatarVoiceUI } from "@/components/chat/avatar-voice-ui"
import Spinner from "@/app/(workspaces)/[workspaceid]/chat/spinner"

// ❗️ ۱. ایمپورت‌های مورد نیاز برای منو
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Settings, LogOut, Home, MessageCircle } from "lucide-react"

const REALTIME_MODEL_ID = "gpt-realtime-mini"

export default function AvatarPage() {
  const { chatSettings, setChatSettings } = useContext(ChatbotUIContext)
  const [isModelReady, setIsModelReady] = useState(false)

  // ❗️ ۲. تعریف state برای منو و هوک‌های لازم
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()
  const params = useParams() // برای گرفتن workspaceid

  // گرفتن workspaceid از URL
  const workspaceid = params.workspaceid as string

  // 💥 LOGGING: چک کردن workspaceid در زمان رندر
  console.log("AvatarPage - Current workspaceid from URL params:", workspaceid)

  useEffect(() => {
    // فقط چک کنید که آیا context آماده است یا نه
    if (!setChatSettings) {
      return
    }

    // اگر chatSettings هنوز لود نشده، صبر کنید تا لود شود
    // اما اگر لود شده، منطق مدل را اجرا کنید
    if (chatSettings) {
      const currentModel = chatSettings.model || ""
      if (currentModel.includes("realtime")) {
        setIsModelReady(true)
      } else {
        setChatSettings(prevSettings => ({
          ...prevSettings,
          model: REALTIME_MODEL_ID
        }))
        // بعد از تنظیم، isModelReady در رندر بعدی true خواهد شد
      }
    } else if (chatSettings === null) {
      // اگر context لود شده ولی chatSettings صراحتا null است
      // (مثلاً کاربر لاگین نکرده)
      // اینجا باید تصمیم بگیرید چه کنید، شاید ریدایرکت؟
      // فعلا فرض می‌کنیم که chatSettings در نهایت مقدار می‌گیرد.
    }
  }, [chatSettings, setChatSettings])

  // ❗️ ۳. توابع برای دکمه‌های منو
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/") // ریدایرکت به صفحه اصلی بعد از خروج
    router.refresh() // رفرش کردن صفحه برای اطمینان
  }

  const handleGoToChat = () => {
    const targetPath =
      workspaceid && workspaceid.trim() !== "" ? `/${workspaceid}/chat` : `/`

    // 💥 LOGGING: چک کردن مسیر نهایی ناوبری
    console.log(
      `handleGoToChat: Attempting to navigate. workspaceid is: ${workspaceid}. Target path: ${targetPath}`
    )

    if (workspaceid && workspaceid.trim() !== "") {
      router.replace(targetPath)
    } else {
      console.warn("Workspace ID نامعتبر است. به صفحه اصلی هدایت می‌شود.")
      router.push(targetPath)
    }
  }

  const handleGoToHome = () => {
    router.push("/")
  }

  // تابع برای باز و بسته کردن منو
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  if (!isModelReady || !chatSettings) {
    return <Spinner />
  }
  console.log("Chat Settings:", chatSettings)
  console.log("Is Model Ready:", isModelReady)
  return (
    <>
      {/* ❗️ ۱. منوی شناور همیشه رندر می‌شود (خارج از شرط) */}
      <div className="font-vazir fixed right-4 top-4 z-[999]">
        {/* دکمه اصلی برای باز کردن منو */}
        <button
          onClick={toggleMenu}
          className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/75"
          aria-label="باز کردن منو"
        >
          <Settings size={24} />
        </button>

        {/* منوی باز شونده */}
        {isMenuOpen && (
          <div
            className="absolute right-0 top-full mt-2 flex w-56 flex-col gap-1 rounded-lg bg-gray-800/90 p-2 text-white shadow-xl backdrop-blur-sm"
            onClick={e => e.stopPropagation()}
          >
            {/* دکمه بازگشت به چت */}
            <button
              onClick={handleGoToChat}
              className="flex w-full items-center gap-3 rounded-md p-2 text-right hover:bg-gray-700/80"
            >
              <MessageCircle size={18} />
              <span>بازگشت به چت</span>
            </button>
            {/* دکمه صفحه اصلی */}
            <button
              onClick={handleGoToHome}
              className="flex w-full items-center gap-3 rounded-md p-2 text-right hover:bg-gray-700/80"
            >
              <Home size={18} />
              <span>صفحه اصلی</span>
            </button>
            {/* جداکننده */}
            <hr className="my-1 border-gray-600/50" />
            {/* دکمه خروج */}
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

      {/* (اختیاری) لایه بستن منو با کلیک روی هرجای صفحه */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-[990]" // <-- لایه ۹۹۰
          onClick={toggleMenu}
        />
      )}

      {/* ❗️ ۲. بخش آواتار و صدا (وابسته به لودینگ) */}
      {/* حالا شرط لودینگ را *اینجا* قرار می‌دهیم */}
      {!isModelReady || !chatSettings ? (
        // اگر آواتار آماده نیست، اسپینر را نشان بده
        <Spinner />
      ) : (
        // اگر آواتار آماده است، بوم سه‌بعدی و UI صدا را نشان بده
        <>
          <Canvas
            shadows
            camera={{ position: [0, 0, 1], fov: 30 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 10 // <-- لایه پس‌زمینه
            }}
          >
            <Suspense fallback={null}>
              <Experience />
              <Preload all />
            </Suspense>
          </Canvas>

          <Loader
            containerStyles={{
              zIndex: 20 // <-- لایه ۲۰
            }}
          />

          <AvatarVoiceUI chatSettings={chatSettings} />
        </>
      )}
    </>
  )
}
