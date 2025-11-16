"use client"
import { FC, useState, useRef, useCallback, useEffect, useContext } from "react"
import { ChatbotUIContext } from "@/context/context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { CircularAudioVisualizer } from "./CircularAudioVisualizer"
import { supabase } from "@/lib/supabase/client"

interface VoiceUIProps {
  chatSettings: any
}

// ✨ بازنویسی شده برای رفع خطاهای import و مستقل شدن کامپوننت
const useAudioVisualizer = (stream: MediaStream | null) => {
  const [volume, setVolume] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
    if (!stream) {
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
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
      dataArrayRef.current = new Uint8Array(analyzer.frequencyBinCount)
      audioContextRef.current = audioContext
    }
    const analyze = () => {
      const analyzer = analyzerRef.current
      const dataArray = dataArrayRef.current

      if (analyzer && dataArray) {
        // ایجاد Uint8Array واقعی روی ArrayBuffer جدید
        const buffer = new ArrayBuffer(dataArray.length)
        const typedArray = new Uint8Array(buffer)
        typedArray.set(dataArray) // کپی داده‌ها به Uint8Array جدید

        analyzer.getByteFrequencyData(typedArray)

        const sum = typedArray.reduce((a, b) => a + b, 0)
        const avg = sum / typedArray.length
        setVolume(avg)
      }

      requestAnimationFrame(analyze)
    }

    analyze()

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [stream])

  return volume
}

const getUserAccessToken = async (): Promise<string | null> => {
  try {
    // 2. استفاده از کلاینت ایمپورت شده
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    if (error) {
      console.error("Supabase getSession error:", error)
      return null
    }

    if (session) {
      return session.access_token
    }

    return null
  } catch (err) {
    console.error("Error fetching user token:", err)
    return null
  }
}
export const AvatarVoiceUI: FC<VoiceUIProps> = ({ chatSettings }) => {
  const fullContextValue = useContext(ChatbotUIContext)
  // console.log("CONTEXT VALUE RECEIVED:", fullContextValue)
  const { setIsSpeechPlaying, setModelVolume } = fullContextValue
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">(
    "idle"
  )

  const dataChannelRef = useRef<RTCDataChannel | null>(null)

  const [userStream, setUserStream] = useState<MediaStream | null>(null)
  const [modelStream, setModelStream] = useState<MediaStream | null>(null)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  const userVolume = useAudioVisualizer(userStream)
  const modelVolume = useAudioVisualizer(modelStream)
  const combinedVolume = Math.max(userVolume, modelVolume)
  useEffect(() => {
    const volumeThreshold = 5 // آستانه سکوت (این عدد را می‌توانید تنظیم کنید)

    if (modelVolume > volumeThreshold) {
      setIsSpeechPlaying(true)
    } else {
      setIsSpeechPlaying(false)
    }

    // ارسال مستقیم ولوم به کانتکست برای انیمیشن نرم
    if (setModelVolume) {
      setModelVolume(modelVolume)
    }
  }, [modelVolume, setIsSpeechPlaying, setModelVolume])
  const stopRealtime = useCallback(() => {
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === "open"
    ) {
      // console.log("➡️ Sending session.terminate event to OpenAI...")
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
    setIsSpeechPlaying(false)
    setStatus("idle")
    // console.log("🛑 Realtime session stopped")
  }, [userStream, modelStream, setIsSpeechPlaying])

  const startRealtime = useCallback(
    async (model: string) => {
      setStatus("connecting")

      // ✨ متغیر sessionData باید در بالاترین سطح scope تابع تعریف شود
      // تا هم در بلاک try و هم در dc.onmessage قابل دسترسی باشد
      let sessionData: any = null

      try {
        // 1. اول توکن را بگیر
        const token = await getUserAccessToken()
        if (!token) {
          throw new Error("User not authenticated. Missing access token.")
        }

        // 2. حالا با سرور خودت تماس بگیر تا session را بسازی
        //    (این همان کدی است که شما به اشتباه پاک کرده بودید)
        const res = await fetch("/api/chat/openai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` // ✨ توکن اینجا استفاده می‌شود
          },
          body: JSON.stringify({
            chatSettings: chatSettings // ارسال کل آبجکت chatSettings
          })
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.message || "Failed to get ephemeral key.")
        }

        // 3. حالا sessionData را مقداردهی کن
        sessionData = await res.json()
        try {
          // console.log(
          //   `✅ Session created (${sessionData.id}). Waiting 1 sec for OpenAI to provision...`
          // )
          await new Promise(resolve => setTimeout(resolve, 1000)) // 1 ثانیه صبر کن
          console.log("...Waited 1 sec. Attempting SDP exchange.")
        } catch (e) {
          // console.error("Error during delay", e)
        }
        // 4. حالا که sessionData را داریم، WebRTC را راه‌اندازی کن
        const pc = new RTCPeerConnection()
        peerConnectionRef.current = pc

        pc.ontrack = e => {
          console.log("🔊 Remote audio track received:", e.streams)
          setModelStream(e.streams[0])

          const audioEl = document.createElement("audio")
          audioEl.srcObject = e.streams[0]
          audioEl.autoplay = true
          audioEl.setAttribute("playsinline", "true")

          document.body.appendChild(audioEl)

          audioEl
            .play()
            .then(() => {
              // console.log("🔊 Model audio playing...")
            })
            .catch(err => {
              // console.error("🚨 Autoplay blocked:", err)
            })
        }

        const dc = pc.createDataChannel("oai-events")
        dataChannelRef.current = dc
        dc.onopen = () => {
          // console.log("📡 DataChannel opened:", dc.label)
        }

        const buffers = new Map<string, string>()

        // 5. حالا onmessage را تعریف کن
        //    (چون sessionData در scope بالاتر تعریف شده، اینجا قابل دسترسی است)
        dc.onmessage = async msg => {
          const data = JSON.parse(msg.data)
          // console.log("📩 RAW event:", data)

          if (data.type === "response.function_call_arguments.delta") {
            // ... (کد شما برای این بخش مشکلی نداشت)
            const id = data.tool_call_id || data.item_id
            if (!id) {
              console.warn("⚠️ No tool_call_id or item_id in delta:", data)
              return
            }
            // console.log("🆔 Using buffer id:", id, " | delta:", data.delta)
            const prev = buffers.get(id) ?? ""
            buffers.set(id, prev + (data.delta ?? ""))
            // console.log("✍️ Partial buffer for", id, ":", buffers.get(id))
          }

          if (data.type === "response.function_call_arguments.done") {
            // ... (کد شما برای این بخش مشکلی نداشت)
            const id = data.tool_call_id || data.item_id
            if (!id) {
              console.warn("⚠️ No tool_call_id or item_id in done:", data)
              return
            }
            // console.log("🆔 Finalizing buffer for id:", id)
            const buffer = buffers.get(id) ?? ""
            buffers.delete(id)
            // console.log("✅ Final buffer (raw):", buffer)
            if (!buffer.startsWith("{") || !buffer.endsWith("}")) {
              // console.warn("⚠️ Incomplete JSON, skipping:", buffer)
              return
            }
            try {
              const args = JSON.parse(buffer)
              const query = args.query
              // console.log("🔎 Search requested:", query)
              if (!query) return
              const token = await getUserAccessToken()
              if (!token) {
                console.error("❌ Cannot search: User token is null.")
                return // اگر توکن نبود، متوقف شو
              }
              // console.log("🌐 Sending query to /api/chat/search ...")
              const searchRes = await fetch("/api/chat/search", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  // ✅ ۲. توکن را به هدر اضافه کنید
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ query })
              })
              // console.log("🌐 Got response, status:", searchRes.status)
              const data = await searchRes.json()
              // console.log("📥 Search API raw response:", data)
              const textResult = data.output_text ?? "No result found."
              let payload
              if (data.tool_call_id) {
                payload = {
                  type: "response.create",
                  response: { conversation: "auto", instructions: textResult }
                }
              } else {
                payload = {
                  type: "response.create",
                  response: { conversation: "auto", instructions: textResult }
                }
              }
              // console.log(
              //   "📦 Payload to realtime:",
              //   JSON.stringify(payload, null, 2)
              // )
              dc.send(JSON.stringify(payload))
              // console.log("✅ Sent results back to model")
            } catch (err) {
              console.error("❌ Error parsing JSON buffer:", buffer, err)
            }
          }

          // 6. این بلاک "done" (ارسال usage) است
          if (data.type === "response.done" && data.response?.usage) {
            const usageData = data.response.usage // <-- 'usage' اینجا تعریف می‌شود
            // console.log(`🔎 اطلاعات توکن برای این پاسخ:`)
            // console.log(`- ورودی: ${usageData.input_tokens} توکن`)
            // console.log(`- خروجی: ${usageData.output_tokens} توکن`)

            // ✨ 7. اینجا راه‌حل قبلی (گرفتن توکن تازه) را اعمال کن
            try {
              const currentToken = await getUserAccessToken() // <-- توکن تازه
              if (!currentToken) {
                console.error(
                  "❌ Could not get user token before sending usage data."
                )
                throw new Error("Missing user token for usage report.")
              }

              // نام متغیر را عوض کن که با res بالا تداخل نکند
              const webhookRes = await fetch("/api/chat/openai", {
                // ✅ ۱. آدرس صحیح
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${currentToken}`
                },
                body: JSON.stringify({
                  // ✅ ۲. بدنه صحیح
                  isUsageReport: true,
                  modelId: chatSettings.model,
                  usage: {
                    input_tokens: usageData.input_tokens,
                    output_tokens: usageData.output_tokens
                  }
                })
              })

              if (!webhookRes.ok) {
                console.error("❌ Error sending usage data to temporary API.")
              }
            } catch (error) {
              console.error("❌ Network error sending usage data:", error)
            }
          }
        } // پایان dc.onmessage

        pc.onconnectionstatechange = () => {
          // console.log("⚡ Connection state:", pc.connectionState)
          if (
            ["disconnected", "failed", "closed"].includes(pc.connectionState)
          ) {
            stopRealtime()
          }
        }

        const ms = await navigator.mediaDevices.getUserMedia({
          audio: {
            noiseSuppression: true,
            echoCancellation: true
          }
        })
        // console.log("🎤 Local stream obtained:", ms)
        setUserStream(ms)

        ms.getAudioTracks().forEach(track => {
          // console.log("🎤 Sending audio track:", track.label, track.readyState)
          pc.addTrack(track, ms)
        })

        // console.log("🎤 Local stream tracks:", ms.getTracks())

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        // 8. حالا از sessionData استفاده کن
        const sessionId = sessionData.id
        const EPHEMERAL_KEY = sessionData.client_secret?.value

        // ۱. استفاده از مدل برگردانده شده از سرور
        const actualModelId = sessionData.model

        if (!sessionId || !EPHEMERAL_KEY || !actualModelId) {
          throw new Error("Session data from backend is incomplete.")
        }

        const sdpResponse = await fetch(
          `https://api.openai.com/v1/realtime?model=${model}`,
          {
            method: "POST",
            body: offer.sdp,
            headers: {
              Authorization: `Bearer ${EPHEMERAL_KEY}`,
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
        stopRealtime()
      }
    },
    [stopRealtime, chatSettings]
  )

  const handleIconClick = () => {
    if (status === "idle") {
      startRealtime(chatSettings.model)
    } else {
      stopRealtime()
    }
  }

  return (
    <>
      {/* بخش UI دکمه اولیه (وقتی status !== 'connected') */}
      <div className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center">
        <div
          onClick={handleIconClick}
          className={cn(
            "relative flex cursor-pointer items-center justify-center rounded-full transition-all duration-500",
            // ❗️ ۲. کلاس‌ها بر اساس status تغییر می‌کنند
            status === "connected"
              ? "bg-gradient-to-br from-red-500 to-red-700 text-white" // قرمز هنگام اتصال
              : "bg-gradient-to-br from-[#4facfe] to-[#8e2de2] text-white", // آبی/بنفش
            "shadow-[0_8px_16px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.5)]",
            "size-20"
          )}
        >
          {/* ❗️ ۳. محتوای دکمه بر اساس status */}
          {status === "connecting" && (
            <svg
              className="size-8 animate-spin"
              /* ... (آیکون لودینگ شما) ... */ fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M4 12v5h.582m15.356 2A8.001 8.001 0 004.582 15"
              />
            </svg>
          )}
          {status === "idle" && (
            <span className="text-4xl">••••</span> // حالت آماده
          )}
          {status === "connected" && (
            <span className="icon-stop-class">■</span> // حالت متصل (از آیکون خودتان استفاده کنید)
          )}
        </div>
        <p className="font-vazir mt-3 text-sm text-white">
          {/* ❗️ ۴. متن زیر دکمه بر اساس status */}
          {status === "idle" && "برای شروع صحبت کلیک کنید"}
          {status === "connecting" && "در حال اتصال..."}
          {status === "connected" && "در حال مکالمه (برای توقف کلیک کنید)"}
        </p>
      </div>
    </>
  )
}
