"use client"

import { FC, useState, useRef, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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

export const VoiceUI: FC<VoiceUIProps> = ({ chatSettings }) => {
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

    setStatus("idle")
    console.log("🛑 Realtime session stopped")
  }, [userStream, modelStream])

  const startRealtime = useCallback(
    async (model: string) => {
      setStatus("connecting")
      try {
        const res = await fetch("/api/chat/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatSettings: { model } })
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.message || "Failed to get ephemeral key.")
        }

        const sessionData = await res.json()
        const EPHEMERAL_KEY = sessionData.client_secret?.value
        if (!EPHEMERAL_KEY) {
          throw new Error("Invalid session data from server.")
        }

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
              console.log("🔊 Model audio playing...")
            })
            .catch(err => {
              console.error("🚨 Autoplay blocked:", err)
            })
        }
        const dc = pc.createDataChannel("oai-events")
        dataChannelRef.current = dc
        dc.onopen = () => {
          console.log("📡 DataChannel opened:", dc.label)
        }

        const buffers = new Map<string, string>()

        dc.onmessage = async msg => {
          const data = JSON.parse(msg.data)
          console.log("📩 RAW event:", data)

          if (data.type === "response.function_call_arguments.delta") {
            const id = data.tool_call_id || data.item_id
            if (!id) {
              console.warn("⚠️ No tool_call_id or item_id in delta:", data)
              return
            }

            console.log("🆔 Using buffer id:", id, " | delta:", data.delta)

            const prev = buffers.get(id) ?? ""
            buffers.set(id, prev + (data.delta ?? ""))
            console.log("✍️ Partial buffer for", id, ":", buffers.get(id))
          }

          if (data.type === "response.function_call_arguments.done") {
            const id = data.tool_call_id || data.item_id
            if (!id) {
              console.warn("⚠️ No tool_call_id or item_id in done:", data)
              return
            }

            console.log("🆔 Finalizing buffer for id:", id)

            const buffer = buffers.get(id) ?? ""
            buffers.delete(id)

            console.log("✅ Final buffer (raw):", buffer)

            if (!buffer.startsWith("{") || !buffer.endsWith("}")) {
              console.warn("⚠️ Incomplete JSON, skipping:", buffer)
              return
            }

            try {
              const args = JSON.parse(buffer)
              const query = args.query
              console.log("🔎 Search requested:", query)

              if (!query) return

              console.log("🌐 Sending query to /api/chat/search ...")
              const searchRes = await fetch("/api/chat/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query })
              })

              console.log("🌐 Got response, status:", searchRes.status)

              const data = await searchRes.json()
              console.log("📥 Search API raw response:", data)

              const textResult = data.output_text ?? "No result found."
              let payload

              if (data.tool_call_id) {
                payload = {
                  type: "response.create",
                  response: {
                    conversation: "auto",
                    instructions: textResult
                  }
                }
              } else {
                payload = {
                  type: "response.create",
                  response: {
                    conversation: "auto",
                    instructions: textResult
                  }
                }
              }

              console.log(
                "📦 Payload to realtime:",
                JSON.stringify(payload, null, 2)
              )
              dc.send(JSON.stringify(payload))

              console.log("✅ Sent results back to model")
            } catch (err) {
              console.error("❌ Error parsing JSON buffer:", buffer, err)
            }
          }

          if (data.type === "response.done" && data.response?.usage) {
            const usage = data.response.usage
            console.log(`🔎 اطلاعات توکن برای این پاسخ:`)
            console.log(`- ورودی: ${usage.input_tokens} توکن`)
            console.log(`- خروجی: ${usage.output_tokens} توکن`)

            // ✨ کد جدید برای ارسال اطلاعات توکن به سرور
            try {
              const res = await fetch("/api/webhooks/openai-realtime/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  // اینجا ID جلسه را هم ارسال می کنیم
                  openaiSessionId: data.response.id,
                  modelId: chatSettings.model,
                  usage: usage
                })
              })

              if (!res.ok) {
                console.error("❌ Error sending usage data to temporary API.")
              }
            } catch (error) {
              console.error("❌ Network error sending usage data:", error)
            }
          }
        }

        pc.onconnectionstatechange = () => {
          console.log("⚡ Connection state:", pc.connectionState)
          if (
            ["disconnected", "failed", "closed"].includes(pc.connectionState)
          ) {
            stopRealtime()
          }
        }

        const ms = await navigator.mediaDevices.getUserMedia({ audio: true })
        setUserStream(ms)

        ms.getAudioTracks().forEach(track => {
          console.log("🎤 Sending audio track:", track.label, track.readyState)
          pc.addTrack(track, ms)
        })

        console.log("🎤 Local stream tracks:", ms.getTracks())

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

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

  const barHeight = (multiplier: number) =>
    Math.max(4, Math.min(20, combinedVolume * multiplier))
  return (
    <>
      {status === "connected" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 bg-black/50"></div>

          <div className="relative z-10 flex flex-col items-center">
            <div
              onClick={handleIconClick}
              className={cn(
                "relative flex cursor-pointer items-center justify-center rounded-full transition-all duration-500",
                "bg-gradient-to-br from-[#4facfe] to-[#8e2de2] text-white",
                "shadow-[0_8px_16px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.5)]",
                "size-48 scale-125"
              )}
            >
              <div className="flex items-end gap-1">
                <div
                  style={{ height: barHeight(8) }}
                  className="w-1 rounded bg-white"
                />
                <div
                  style={{ height: barHeight(12) }}
                  className="w-1 rounded bg-white"
                />
                <div
                  style={{ height: barHeight(20) }}
                  className="w-1 rounded bg-white"
                />
                <div
                  style={{ height: barHeight(12) }}
                  className="w-1 rounded bg-white"
                />
                <div
                  style={{ height: barHeight(8) }}
                  className="w-1 rounded bg-white"
                />
              </div>
            </div>

            <div className="absolute -z-10 size-48 animate-ping rounded-full bg-gradient-to-br from-[#4facfe] to-[#8e2de2]"></div>

            <p className="font-vazir mt-6 text-sm text-white">
              متصل شد! می‌توانید صحبت کنید.
            </p>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center">
          <div
            onClick={handleIconClick}
            className={cn(
              "relative flex cursor-pointer items-center justify-center rounded-full transition-all duration-500",
              "bg-gradient-to-br from-[#4facfe] to-[#8e2de2] text-white",
              "shadow-[0_8px_16px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_16px_rgba(0,0,0,0.5)]",
              "size-20"
            )}
          >
            {status === "connecting" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-spin"
              >
                <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
              </svg>
            ) : (
              "••••"
            )}
          </div>
          <p className="font-vazir mt-3 text-sm text-white">
            {status === "idle" && "برای شروع صحبت کلیک کنید"}
            {status === "connecting" && "در حال اتصال..."}
          </p>
        </div>
      )}
    </>
  )
}
