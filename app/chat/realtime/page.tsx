"use client"

import React, { FC, useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils" // (cn) شما از قبل در پروژه وجود دارد
import { toast, Toaster } from "sonner" // برای نمایش خطاها
import { motion, AnimatePresence } from "framer-motion"

const remoteLog = (message: string) => {
  // لاگ در کنسول محلی (اگر inspect شانسی برای باز شدن داشت)
  console.log(message)

  // ارسال لاگ به سرور Vercel
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // ما پیام را با [VoiceUI] شروع می‌کنیم تا در لاگ‌های Vercel مشخص باشد
    body: JSON.stringify({ message: `[VoiceUI] ${message}` })
  }).catch(err => console.error("Remote log failed:", err)) // خطا در ارسال لاگ را نادیده می‌گیریم
}

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

const useAudioActivityDetector = (
  stream: MediaStream | null,
  onActivityChange: (isActive: boolean) => void,
  options = { threshold: 10, silenceDelay: 500 } // آستانه حساسیت و تاخیر سکوت
) => {
  const contextRef = useRef<{
    audioContext: AudioContext
    analyser: AnalyserNode
    animationFrameId: number
    silenceTimerId: NodeJS.Timeout | null
    isSpeaking: boolean
  } | null>(null)

  useEffect(() => {
    // اگر استریم وجود ندارد، همه چیز را پاکسازی کن
    if (!stream) {
      if (contextRef.current) {
        cancelAnimationFrame(contextRef.current.animationFrameId)
        if (contextRef.current.silenceTimerId)
          clearTimeout(contextRef.current.silenceTimerId)
        contextRef.current.audioContext.close().catch(console.error)
        if (contextRef.current.isSpeaking) {
          onActivityChange(false) // گزارش توقف فعالیت
        }
        contextRef.current = null
      }
      return
    }

    // اگر استریم وجود دارد، آنالایزر را بساز
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    contextRef.current = {
      audioContext,
      analyser,
      animationFrameId: 0,
      silenceTimerId: null,
      isSpeaking: false
    }

    const analyze = () => {
      const ctx = contextRef.current
      if (!ctx) return

      ctx.analyser.getByteFrequencyData(dataArray)
      const sum = dataArray.reduce((a, b) => a + b, 0)
      const avg = sum / dataArray.length

      if (avg > options.threshold) {
        // صدا تشخیص داده شد
        if (ctx.silenceTimerId) {
          clearTimeout(ctx.silenceTimerId)
          ctx.silenceTimerId = null
        }
        if (!ctx.isSpeaking) {
          ctx.isSpeaking = true
          onActivityChange(true) // گزارش: «شروع به صحبت کرد»
        }
      } else if (ctx.isSpeaking && !ctx.silenceTimerId) {
        // سکوت تشخیص داده شد، تایمر را برای گزارش سکوت فعال کن
        ctx.silenceTimerId = setTimeout(() => {
          ctx.isSpeaking = false
          onActivityChange(false) // گزارش: «صحبت تمام شد»
          ctx.silenceTimerId = null
        }, options.silenceDelay)
      }

      ctx.animationFrameId = requestAnimationFrame(analyze)
    }

    analyze()

    // تابع پاکسازی نهایی
    return () => {
      if (contextRef.current) {
        cancelAnimationFrame(contextRef.current.animationFrameId)
        if (contextRef.current.silenceTimerId)
          clearTimeout(contextRef.current.silenceTimerId)
        contextRef.current.audioContext.close().catch(console.error)
        contextRef.current = null
      }
    }
  }, [stream, onActivityChange, options.threshold, options.silenceDelay])
}

const RealtimeVoicePage: FC = () => {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">(
    "idle"
  )
  const [model, setModel] = useState<string>("gpt-realtime-mini")

  // ✅ [اصلاح اصلی ۱]
  // یک state برای نگهداری توکن اضافه می‌کنیم
  const [supabaseToken, setSupabaseToken] = useState<string | null>(null)

  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const [userStream, setUserStream] = useState<MediaStream | null>(null)
  const [modelStream, setModelStream] = useState<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const userAudioSenderRef = useRef<RTCRtpSender | null>(null)

  const userVolume = useAudioVisualizer(userStream)
  const modelVolume = useAudioVisualizer(modelStream)
  const combinedVolume = Math.max(userVolume, modelVolume)

  const handleModelSpeaking = useCallback((isSpeaking: boolean) => {
    // چک کن که آیا فرستنده صدای کاربر (که به OpenAI می‌رود) وجود دارد
    if (userAudioSenderRef.current && userAudioSenderRef.current.track) {
      if (isSpeaking) {
        // اگر مدل صحبت می‌کند، میکروفون کاربر را Mute کن
        remoteLog("🔇 Model is speaking, MUTING user mic track.")
        userAudioSenderRef.current.track.enabled = false
      } else {
        // اگر مدل ساکت شد، میکروفون کاربر را Unmute کن
        remoteLog("🎤 Model stopped speaking, UNMUTING user mic track.")
        userAudioSenderRef.current.track.enabled = true
      }
    }
  }, []) // وابستگی خالی درست است، چون ما همیشه از Ref می‌خوانیم

  // ۲. هوک جدید را فعال کن تا به صدای مدل گوش دهد
  useAudioActivityDetector(modelStream, handleModelSpeaking)

  useEffect(() => {
    remoteLog("Page component mounted. Adding global error listener.")

    const handleError = (event: ErrorEvent) => {
      // این بخش هرگونه کرش جاوا اسکریپت در صفحه را لاگ می‌کند
      remoteLog(
        `!!! GLOBAL CRASH !!! Message: ${event.message}, File: ${event.filename}, Line: ${event.lineno}`
      )
    }

    window.addEventListener("error", handleError)

    return () => {
      window.removeEventListener("error", handleError)
    }
  }, [])

  useEffect(() => {
    remoteLog("Token polling effect started.")
    const intervalId = setInterval(() => {
      const token = (window as any).SUPABASE_ACCESS_TOKEN
      remoteLog(
        `Polling... window token is: ${token ? token.substring(0, 10) + "..." : "null"}`
      )

      if (typeof window !== "undefined" && token) {
        remoteLog("SUCCESS! Token found on window object!")
        setSupabaseToken(token)
        delete (window as any).SUPABASE_ACCESS_TOKEN
        clearInterval(intervalId)
      }
    }, 250)
    return () => clearInterval(intervalId)
  }, [])

  // خواندن مدل از URL (بدون تغییر)
  useEffect(() => {
    // ۱. یک اینتروال برای چک کردن متغیر سراسری بساز
    const intervalId = setInterval(() => {
      // ✅✅✅ لاگ اشکال‌زدایی اضافه شد ✅✅✅
      console.log(
        "DEBUG: Polling for token... Current window token:",
        (window as any).SUPABASE_ACCESS_TOKEN
      )

      // ۲. چک کن آیا متغیر توسط React Native تزریق شده است؟
      if (
        typeof window !== "undefined" &&
        (window as any).SUPABASE_ACCESS_TOKEN
      ) {
        const token = (window as any).SUPABASE_ACCESS_TOKEN
        console.log("✅✅✅ [WebView] SUCCESS! Token found on window object!")
        setSupabaseToken(token)

        // ۳. متغیر را پاک کن (اختیاری اما امن)
        delete (window as any).SUPABASE_ACCESS_TOKEN

        // ۴. اینتروال را متوقف کن
        clearInterval(intervalId)
      } else {
        // ۵. تا زمانی که توکن پیدا نشده، لاگ بزن
        console.log(
          "⌛️ [WebView] Polling: window.SUPABASE_ACCESS_TOKEN not found yet..."
        )
      }
    }, 250) // هر 250 میلی‌ثانیه چک کن

    return () => {
      clearInterval(intervalId) // پاک کردن اینتروال در زمان unmount
    }
  }, [])
  // تابع بستن و اطلاع‌رسانی به اپ نیتیو
  const closeWebView = () => {
    if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
      // ✅ [اصلاح] ما هنوز برای بستن به postMessage نیاز داریم
      ;(window as any).ReactNativeWebView.postMessage(
        JSON.stringify({ type: "close-webview" })
      )
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
    remoteLog("--- startRealtime function triggered ---")
    setStatus("connecting")
    let sessionData: any = null

    try {
      remoteLog("Reading token from window (using state)...")
      // ❗️❗️❗️ ما همچنان از state می‌خوانیم چون polling باید اول تمام شده باشد
      if (!supabaseToken) {
        remoteLog("FATAL: Token not found in state (supabaseToken is null).")
        throw new Error("Token not found in React state.")
      }

      remoteLog(`Token found in state. Calling /api/chat/openai...`)
      const res = await fetch("https://www.rhynoai.ir/api/chat/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseToken}` // ✅ استفاده از توکن state
        },
        body: JSON.stringify({ chatSettings: { model: model }, messages: [] })
      })

      remoteLog(`API call response status: ${res.status}`)
      if (!res.ok) {
        const errorData = await res.json()
        remoteLog(`API call failed: ${errorData.message}`)
        throw new Error(errorData.message || "Failed to get ephemeral key.")
      }

      sessionData = await res.json()
      remoteLog("Session data received from /api/chat.")

      // ❗️❗️❗️ [لاگ ۱: پاسخ کامل API را ببینیم] ❗️❗️❗️
      console.log(
        "✅ Session data received from /api/chat:",
        JSON.stringify(sessionData, null, 2)
      )

      // ❗️ بر اساس route.ts شما، توکن در اینجا قرار دارد
      const EPHEMERAL_KEY = sessionData.client_secret?.value

      // ❗️❗️❗️ [لاگ ۲: ببینیم توکن پیدا شد یا نه] ❗️❗️❗️
      console.log(
        "🔑 Extracted EPHEMERAL_KEY:",
        EPHEMERAL_KEY ? "Found" : "NOT FOUND"
      )

      if (!EPHEMERAL_KEY) {
        remoteLog("FATAL: client_secret not found in session data.")
        throw new Error("Invalid session data: client_secret.value is missing.")
      }
      remoteLog("Ephemeral key extracted. Setting up WebRTC...")
      const pc = new RTCPeerConnection()
      peerConnectionRef.current = pc

      pc.ontrack = e => {
        remoteLog("🔊 Remote audio track received!") // <-- لاگ اصلاح شد
        setModelStream(e.streams[0])

        // ... (حذف <audio> قبلی)
        const audioEl = document.createElement("audio")
        audioEl.id = "model_audio"
        audioEl.srcObject = e.streams[0]
        audioEl.autoplay = true
        audioEl.setAttribute("playsinline", "true")
        document.body.appendChild(audioEl)

        remoteLog("Attempting to autoplay model audio...") // <-- لاگ مهم

        audioEl
          .play()
          .then(() => {
            // اگر صدا با موفقیت پخش شود
            remoteLog("🔊 SUCCESS: Model audio playing.")
          })
          .catch(err => {
            // اگر پخش خودکار شکست بخورد
            console.error("🚨 Autoplay blocked:", err)
            remoteLog(
              `🚨 ERROR: Autoplay blocked: ${err instanceof Error ? err.message : String(err)}`
            ) // <-- لاگ حیاتی
            toast.error("مرورگر اجازه پخش خودکار صدا را نداد.")
          })
      }

      const dc = pc.createDataChannel("oai-events")
      dataChannelRef.current = dc
      dc.onopen = () => console.log("📡 DataChannel opened:", dc.label)

      const buffers = new Map<string, string>()

      // ۵. تعریف onmessage (منطق فانکشن کال شما)
      // ۵. تعریف onmessage (منطق فانکشن کال شما)
      dc.onmessage = async msg => {
        const data = JSON.parse(msg.data)
        remoteLog("raw data is logging :")
        remoteLog(JSON.stringify(data, null, 2))
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
            console.log(
              `[AUTH DEBUG] Sending token: ${supabaseToken ? supabaseToken.substring(0, 10) + "..." : "TOKEN IS NULL!"}`
            )
            // ❗️❗️❗️ [اصلاح اصلی اینجاست] ❗️❗️❗️
            const searchRes = await fetch("/api/chat/search", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                // ✅ این خط مشکل را برطرف می‌کند
                Authorization: `Bearer ${supabaseToken}`
              },
              body: JSON.stringify({ query })
            })

            // بررسی کنید که آیا خود درخواست جست‌وجو موفق بود یا نه
            if (!searchRes.ok) {
              const errorText = await searchRes.text()
              console.error(
                `Search API failed with status ${searchRes.status}: ${errorText}`
              )
              remoteLog(
                `Search API failed with status ${searchRes.status}: ${errorText}`
              )
              // ما خطای اصلی را به عنوان JSON برمی‌گردانیم تا سینتکس ارور ندهیم
              // اما در اینجا چون سرور 401 داده، ما فقط لاگ می‌گیریم و متوقف می‌شویم
              return
            }

            const searchData = await searchRes.json()
            const textResult = searchData.output_text ?? "No result found."

            const payload = {
              type: "response.create",
              response: { conversation: "auto", instructions: textResult }
            }
            dc.send(JSON.stringify(payload))
            console.log("✅ Sent search results back to model")
          } catch (err: any) {
            console.error(
              "❌ Error parsing JSON buffer or fetching search:",
              buffer,
              err
            )
            remoteLog(`❌ Error in function call 'done': ${err.message}`)
          }
        }

        if (data.type === "response.done") {
          console.log("✅ Response.done received from OpenAI.")
        }
      }

      pc.onconnectionstatechange = () => {
        console.log("⚡ Connection state:", pc.connectionState)
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          stopRealtime()
        }
      }

      // ۷. دریافت میکروفون کاربر
      try {
        remoteLog("Attempting to get user microphone (getUserMedia)...")
        const ms = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true
          }
        })
        remoteLog("✅ SUCCESS: User microphone stream obtained.")
        setUserStream(ms)
        remoteLog("🚀 Sending 'audio-ready' message to React Native.")
        if (
          typeof window !== "undefined" &&
          (window as any).ReactNativeWebView
        ) {
          ;(window as any).ReactNativeWebView.postMessage(
            JSON.stringify({ type: "audio-ready" })
          )
        }
        ms.getAudioTracks().forEach(track => {
          remoteLog(`🎤 Sending audio track: ${track.label}`)
          const sender = pc.addTrack(track, ms)
          userAudioSenderRef.current = sender
        })
      } catch (micError: any) {
        // ❗️❗️❗️ این لاگ به احتمال زیاد در شبیه‌ساز ظاهر می‌شود ❗️❗️❗️
        remoteLog(
          `🚨 FATAL MIC ERROR: getUserMedia failed: ${micError.message}`
        )
        toast.error(`خطای میکروفون: ${micError.message}`)
        stopRealtime() // اگر میکروفون را نگیریم، متوقف شو
        return // از تابع خارج شو
      }

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
    } catch (error: any) {
      remoteLog(`!!! CATCH block error in startRealtime !!!: ${error.message}`)
      toast.error(`خطا: ${error.message}`)
      stopRealtime()
    }
  }, [stopRealtime, model, supabaseToken])

  const handleIconClick = () => {
    if (status === "idle" && supabaseToken) {
      remoteLog("Icon clicked to start.") // <-- لاگ کلیک
      startRealtime()
    } else if (status !== "idle") {
      remoteLog("Icon clicked to stop.") // <-- لاگ کلیک
      stopRealtime()
    } else {
      remoteLog("Icon clicked, but token is not ready yet.") // <-- لاگ کلیک
      toast.error("در حال همگام‌سازی... لطفاً لحظه‌ای صبر کنید.")
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
              "shadow-lg shadow-blue-500/30",
              // ✅ [اصلاح اصلی ۴]
              // دکمه را تا زمان دریافت توکن غیرفعال نشان بده
              !supabaseToken && "cursor-not-allowed opacity-50"
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
            {status === "idle" && !supabaseToken && "در حال همگام‌سازی..."}
            {status === "idle" && supabaseToken && "برای شروع صحبت کلیک کنید"}
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
