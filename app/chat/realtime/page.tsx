"use client"

import React, { FC, useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils" // (cn) شما از قبل در پروژه وجود دارد
import { toast, Toaster } from "sonner" // برای نمایش خطاها
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabase/client" // کلاینت سوپابیس شما

// ------------------------------------------------------------------
// کامپوننت ویژوالایزر صوتی (بازسازی شده برای وب با Tailwind)
// ------------------------------------------------------------------
const CircularAudioVisualizer: FC<{ volume: number }> = ({ volume }) => {
  // حجم صدا را به یک مقدار لگاریتمی تبدیل می‌کنیم تا نوسان زیباتر باشد
  const scale = Math.log(1 + volume * 2) * 0.5 + 1
  const opacity = Math.min(volume / 50, 0.5)

  return (
    <div className="relative flex size-64 items-center justify-center">
      {/* هاله بیرونی */}
      <motion.div
        className="absolute size-full rounded-full border border-blue-500/30 bg-blue-500/10"
        animate={{
          scale: scale * 1.1,
          opacity: opacity * 0.8
        }}
        transition={{ duration: 0.1, ease: "easeOut" }}
      />
      {/* هاله میانی */}
      <motion.div
        className="absolute size-48 rounded-full border border-blue-500/50 bg-blue-500/20"
        animate={{
          scale: scale,
          opacity: opacity
        }}
        transition={{ duration: 0.1, ease: "easeOut" }}
      />
      {/* دکمه میکروفون داخلی */}
      <div className="flex size-32 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
        <svg
          className="size-16 text-white"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
            fill="currentColor"
          />
          <path
            d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// هوک ویژوالایزر (اصلاح شده برای رفع خطای TS(2345))
// ------------------------------------------------------------------
const useAudioVisualizer = (stream: MediaStream | null) => {
  const [volume, setVolume] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!stream) {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error)
        audioContextRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setVolume(0)
      return
    }

    if (!audioContextRef.current) {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)()
      const analyzer = audioContext.createAnalyser()
      analyzer.fftSize = 256
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyzer)
      analyzerRef.current = analyzer
      audioContextRef.current = audioContext
    }

    const analyze = () => {
      const analyzer = analyzerRef.current

      if (analyzer) {
        // ✅ [اصلاح TS(2345)]
        // یک آرایه موقت با تایپ صحیح می‌سازیم تا تابع بتواند در آن بنویسد
        const tempArray = new Uint8Array(analyzer.frequencyBinCount)
        analyzer.getByteFrequencyData(tempArray)

        const sum = tempArray.reduce((a, b) => a + b, 0)
        const avg = sum / tempArray.length
        setVolume(avg)
      }
      animationFrameRef.current = requestAnimationFrame(analyze)
    }

    analyze()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error)
        audioContextRef.current = null
      }
    }
  }, [stream])

  return volume
}

// ------------------------------------------------------------------
// تابع کمکی توکن (خواندن از localStorage)
// ------------------------------------------------------------------
const getSupabaseToken = (): string | null => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("supabase-access-token")
    console.log(
      token
        ? "✅ Token found in localStorage."
        : "❌ Token not found in localStorage."
    )
    return token
  }
  return null
}

// ------------------------------------------------------------------
// کامپوننت اصلی صفحه
// ------------------------------------------------------------------
const RealtimeVoicePage: FC = () => {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">(
    "idle"
  )
  const [model, setModel] = useState<string>("gpt-4o-realtime-preview") // مدل پیش‌فرض
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const [userStream, setUserStream] = useState<MediaStream | null>(null)
  const [modelStream, setModelStream] = useState<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  const userVolume = useAudioVisualizer(userStream)
  const modelVolume = useAudioVisualizer(modelStream)
  const combinedVolume = Math.max(userVolume, modelVolume)

  // ✅ [اصلاح `next/navigation`]
  // خواندن مدل از URL در useEffect
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search)
      const modelFromUrl = searchParams.get("model")
      if (modelFromUrl) {
        console.log("Model specified in URL:", modelFromUrl)
        setModel(modelFromUrl)
      }
    }
  }, [])

  // تابع بستن و اطلاع‌رسانی به اپ نیتیو
  const closeWebView = () => {
    if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
      console.log("➡️ Sending 'close-webview' message to native app...")
      ;(window as any).ReactNativeWebView.postMessage("close-webview")
    } else {
      console.log("Not in WebView, cannot send 'close-webview' message.")
    }
  }

  const stopRealtime = useCallback(() => {
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === "open"
    ) {
      console.log("➡️ Sending session.terminate event to OpenAI...")
      dataChannelRef.current.send(JSON.stringify({ type: "session.terminate" }))
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (userStream) {
      userStream.getTracks().forEach(track => track.stop())
      setUserStream(null)
    }

    if (modelStream) {
      modelStream.getTracks().forEach(track => track.stop())
      setModelStream(null)
    }

    // بستن تمام تگ‌های <audio> که ساخته شده‌اند
    document.querySelectorAll("audio").forEach(el => el.remove())

    setStatus("idle")
    console.log("🛑 Realtime session stopped")
    closeWebView() // <-- به اپ نیتیو اطلاع می‌دهد که بسته شود
  }, [userStream, modelStream])

  const startRealtime = useCallback(async () => {
    setStatus("connecting")

    let sessionData: any = null

    try {
      // ۱. توکن را از localStorage (که توسط اپ نیتیو تزریق شده) می‌خوانیم
      let token = getSupabaseToken()
      if (!token) {
        console.warn("Token not found, retrying in 1s...")
        await new Promise(resolve => setTimeout(resolve, 1000))
        token = getSupabaseToken()
        if (!token) {
          throw new Error(
            "User not authenticated. Missing access token in localStorage."
          )
        }
      }

      // ۲. با سرور اصلی (route.ts) تماس می‌گیریم
      console.log(`🚀 Calling /api/chat for model: ${model}`)
      const res = await fetch("/api/chat", {
        // ❗️❗️ آدرس API اصلی شما
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` // توکن را اینجا استفاده می‌کنیم
        },
        body: JSON.stringify({ chatSettings: { model: model }, messages: [] })
      })

      if (!res.ok) {
        const errorData = await res.json()
        console.error("❌ Error from /api/chat:", errorData)
        throw new Error(errorData.message || "Failed to get ephemeral key.")
      }

      // ۳. حالا sessionData را مقداردهی کن
      sessionData = await res.json()
      console.log("✅ Session data received from /api/chat:", sessionData)

      // ❗️ بر اساس route.ts شما، توکن در اینجا قرار دارد
      const EPHEMERAL_KEY = sessionData.client_secret?.value
      if (!EPHEMERAL_KEY) {
        throw new Error("Invalid session data: client_secret.value is missing.")
      }

      // ۴. راه‌اندازی WebRTC
      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

      pc.ontrack = e => {
        console.log("🔊 Remote audio track received:", e.streams)
        setModelStream(e.streams[0])

        // حذف <audio> قبلی اگر وجود داشت
        document
          .querySelectorAll("audio#model_audio")
          .forEach(el => el.remove())

        const audioEl = document.createElement("audio")
        audioEl.id = "model_audio" // یک آیدی برای مدیریت بهتر
        audioEl.srcObject = e.streams[0]
        audioEl.autoplay = true
        audioEl.setAttribute("playsinline", "true") // برای iOS
        document.body.appendChild(audioEl)

        audioEl
          .play()
          .then(() => console.log("🔊 Model audio playing..."))
          .catch(err => {
            console.error("🚨 Autoplay blocked:", err)
            toast.error("مرورگر اجازه پخش خودکار صدا را نداد.")
          })
      }

      const dc = pc.createDataChannel("oai-events")
      dataChannelRef.current = dc
      dc.onopen = () => console.log("📡 DataChannel opened:", dc.label)

      const buffers = new Map<string, string>()

      // ۵. تعریف onmessage (منطق فانکشن کال شما)
      dc.onmessage = async msg => {
        const data = JSON.parse(msg.data)

        if (data.type === "response.function_call_arguments.delta") {
          const id = data.tool_call_id || data.item_id
          if (!id) return
          const prev = buffers.get(id) ?? ""
          buffers.set(id, prev + (data.delta ?? ""))
        }

        if (data.type === "response.function_call_arguments.done") {
          const id = data.tool_call_id || data.item_id
          if (!id) return
          const buffer = buffers.get(id) ?? ""
          buffers.delete(id)
          if (!buffer.startsWith("{") || !buffer.endsWith("}")) return

          try {
            const args = JSON.parse(buffer)
            const query = args.query
            console.log("🔎 Search requested:", query)
            if (!query) return

            const searchRes = await fetch("/api/chat/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query })
            })

            const searchData = await searchRes.json()
            const textResult = searchData.output_text ?? "No result found."

            const payload = {
              type: "response.create",
              response: { conversation: "auto", instructions: textResult }
            }
            dc.send(JSON.stringify(payload))
            console.log("✅ Sent search results back to model")
          } catch (err) {
            console.error("❌ Error parsing JSON buffer:", buffer, err)
          }
        }

        if (data.type === "response.done") {
          console.log("✅ Response.done received from OpenAI.")
        }
      } // پایان dc.onmessage

      pc.onconnectionstatechange = () => {
        console.log("⚡ Connection state:", pc.connectionState)
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          stopRealtime()
        }
      }

      // ۷. دریافت میکروفون کاربر
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true
        }
      })
      console.log("🎤 Local stream obtained:", ms)
      setUserStream(ms)

      ms.getAudioTracks().forEach(track => {
        console.log("🎤 Sending audio track:", track.label)
        pc.addTrack(track, ms)
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // ۸. تبادل SDP با OpenAI
      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=${model}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`, // ❗️ استفاده از توکن OpenAI
            "Content-Type": "application/sdp"
          }
        }
      )

      if (!sdpResponse.ok) {
        throw new Error(`SDP exchange failed: ${sdpResponse.statusText}`)
      }

      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResponse.text()
      }
      await pc.setRemoteDescription(answer)
      setStatus("connected")
      console.log("✅ Realtime session started")
    } catch (error) {
      console.error(
        `❌ Could not start voice chat: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      )
      toast.error(
        `خطا در شروع چت صوتی: ${error instanceof Error ? error.message : "خطای ناشناخته"}`
      )
      stopRealtime() // در صورت خطا، بسته شود
    }
  }, [stopRealtime, model]) // 'model' به وابستگی‌ها اضافه شد

  const handleIconClick = () => {
    if (status === "idle") {
      startRealtime()
    } else {
      stopRealtime()
    }
  }

  // UI را در یک div تمام‌صفحه سیاه قرار می‌دهیم تا با اپ نیتیو یکسان باشد
  return (
    <div className="font-vazir fixed inset-0 bg-black text-white">
      {/* ❗️ برای نمایش خطاهای toast، این کامپوننت لازم است */}
      <Toaster position="top-center" richColors />

      <AnimatePresence>
        {status === "connected" && (
          <motion.div
            onClick={handleIconClick} // با کلیک روی پس‌زمینه هم بسته شود
            className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* کامپوننت ویژوالایزر */}
            <CircularAudioVisualizer volume={combinedVolume} />

            <p className="mt-12 text-lg text-white">در حال شنیدن...</p>
            <p className="mt-2 text-sm text-gray-400">
              برای پایان دادن به مکالمه کلیک کنید
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* بخش UI دکمه اولیه (وقتی status !== 'connected') */}
      {status !== "connected" && (
        <div className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center">
          <div
            onClick={handleIconClick}
            className={cn(
              "relative flex size-20 cursor-pointer items-center justify-center rounded-full transition-all duration-500",
              "bg-gradient-to-br from-blue-500 to-indigo-600 text-white",
              "shadow-lg shadow-blue-500/30"
            )}
          >
            {status === "connecting" ? (
              // آیکون لودینگ
              <svg
                className="size-10 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              // آیکون میکروفون
              <svg
                className="size-10 text-white"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                  fill="currentColor"
                />
                <path
                  d="M19 10v2a7 7 0 01-14 0v-2H3v2a9 9 0 008 8.94V23h2v-2.06A9 9 0 0021 12v-2h-2z"
                  fill="currentColor"
                />
              </svg>
            )}
          </div>
          <p className="mt-3 text-sm text-white">
            {status === "idle" && "برای شروع صحبت کلیک کنید"}
            {status === "connecting" && "در حال اتصال..."}
          </p>
        </div>
      )}
    </div>
  )
}

// ❗️❗️ [مهم] ❗️❗️
// ما به این Wrapper دیگر نیازی نداریم چون useSearchParams حذف شد.
// مستقیماً کامپوننت اصلی را export کنید.
export default RealtimeVoicePage
