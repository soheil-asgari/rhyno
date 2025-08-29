"use client"

import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import {
  IconCirclePlus,
  IconLoader2,
  IconMicrophone,
  IconPlayerRecordFilled,
  IconPlayerStopFilled,
  IconSend
} from "@tabler/icons-react"
import dynamic from "next/dynamic"
import { FC, useCallback, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Input } from "../ui/input"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { useChatHandler } from "./chat-hooks/use-chat-handler"
import { useChatHistoryHandler } from "./chat-hooks/use-chat-history"
import { usePromptAndCommand } from "./chat-hooks/use-prompt-and-command"
import { useSelectFileHandler } from "./chat-hooks/use-select-file-handler"

// کامپوننت‌های داینامیک
const ChatCommandInput = dynamic(() =>
  import("./chat-command-input").then(mod => mod.ChatCommandInput)
)
const ChatFilesDisplay = dynamic(() =>
  import("./chat-files-display").then(mod => mod.ChatFilesDisplay)
)
const SelectedAssistant = dynamic(() =>
  import("./selected-assistant").then(mod => mod.SelectedAssistant)
)
const SelectedTools = dynamic(() =>
  import("./selected-tools").then(mod => mod.SelectedTools)
)

interface ChatInputProps {}

export const ChatInput: FC<ChatInputProps> = ({}) => {
  const [isTyping, setIsTyping] = useState<boolean>(false)

  // =================================================================
  // ✨ اصلاح کلیدی: تمام هوک‌ها و متغیرهای مورد نیاز به بالای کامپوننت منتقل شدند
  // تا قبل از استفاده، تعریف شده باشند.
  // =================================================================
  const context = useContext(ChatbotUIContext)
  const {
    userInput,
    chatMessages,
    isGenerating,
    selectedPreset,
    selectedAssistant,
    isPromptPickerOpen,
    setIsPromptPickerOpen,
    isFilePickerOpen,
    isToolPickerOpen,
    isAssistantPickerOpen,
    chatSettings,
    newMessageImages
  } = context

  const { handleInputChange } = usePromptAndCommand()

  // =================================================================
  // بخش Realtime
  // =================================================================
  const [isRealtimeConnecting, setIsRealtimeConnecting] = useState(false)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const textInputDataChannelRef = useRef<RTCDataChannel | null>(null)

  const stopRealtime = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    setIsRealtimeConnected(false)
    setIsRealtimeConnecting(false)
    console.log("Realtime session stopped 🛑")
  }, [])

  const startRealtime = useCallback(
    async (model: string) => {
      if (isRealtimeConnected || isRealtimeConnecting) return
      setIsRealtimeConnecting(true)

      try {
        const res = await fetch("/api/chat/openai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatSettings: { model } })
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(
            errorData.message ||
              "Failed to get an ephemeral key from the server."
          )
        }

        const sessionData = await res.json()
        const EPHEMERAL_KEY = sessionData.client_secret?.value
        if (!EPHEMERAL_KEY) {
          throw new Error("Invalid session data received from server.")
        }

        const pc = new RTCPeerConnection()
        peerConnectionRef.current = pc

        pc.ontrack = e => {
          if (audioElRef.current) {
            audioElRef.current.srcObject = e.streams[0]
          }
        }

        pc.onconnectionstatechange = () => {
          if (
            pc.connectionState === "disconnected" ||
            pc.connectionState === "failed" ||
            pc.connectionState === "closed"
          ) {
            stopRealtime()
          }
        }

        const textInputDc = pc.createDataChannel("text-input")
        textInputDc.onopen = () => console.log("Text data channel opened ✅")
        textInputDc.onclose = () => console.log("Text data channel closed 🛑")
        textInputDataChannelRef.current = textInputDc

        const ms = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioStreamRef.current = ms
        ms.getTracks().forEach(track => pc.addTrack(track, ms))

        const dc = pc.createDataChannel("oai-events")
        dc.onmessage = e => console.log("Event:", e.data)

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

        setIsRealtimeConnected(true)
        console.log("Realtime session started ✅")
      } catch (error) {
        console.error("Error starting realtime session:", error)
        toast.error(
          `Could not start voice chat: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        )
        stopRealtime()
      } finally {
        setIsRealtimeConnecting(false)
      }
    },
    [isRealtimeConnected, isRealtimeConnecting, stopRealtime, chatSettings]
  )

  const sendRealtimeText = useCallback(
    (text: string) => {
      if (textInputDataChannelRef.current?.readyState === "open") {
        const message = { type: "text", text }
        textInputDataChannelRef.current.send(JSON.stringify(message))
        console.log("Sent text message:", message)
        handleInputChange("")
      } else {
        toast.error("Text channel is not open. Cannot send message.")
      }
    },
    [handleInputChange]
  )

  const handleToggleRealtime = () => {
    if (isRealtimeConnected) {
      stopRealtime()
    } else {
      const realtimeModel = chatSettings?.model
      if (!realtimeModel || !realtimeModel.includes("realtime")) {
        toast.error("Please select a realtime model to use voice chat.")
        return
      }
      startRealtime(realtimeModel)
    }
  }

  // useEffect(() => {
  //   return () => {
  //     stopRealtime()
  //   }
  // }, [stopRealtime])

  // =================================================================
  // سایر هوک‌ها و منطق UI
  // =================================================================

  const {
    chatInputRef,
    handleSendMessage,
    handleStopMessage,
    handleFocusChatInput
  } = useChatHandler()

  useHotkey("l", () => handleFocusChatInput())

  const { filesToAccept, handleSelectDeviceFile } = useSelectFileHandler()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      handleFocusChatInput()
    }, 200)
    return () => clearTimeout(timer)
  }, [selectedPreset, selectedAssistant, handleFocusChatInput])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isTyping && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        setIsPromptPickerOpen(false)

        if (isRealtimeConnected) {
          if (userInput) sendRealtimeText(userInput)
        } else {
          if (userInput) handleSendMessage(userInput, chatMessages, false)
        }
      }
    },
    [
      isTyping,
      userInput,
      chatMessages,
      handleSendMessage,
      setIsPromptPickerOpen,
      isRealtimeConnected,
      sendRealtimeText
    ]
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const imagesAllowed = LLM_LIST.find(
        llm => llm.modelId === chatSettings?.model
      )?.imageInput

      const items = event.clipboardData.items
      for (const item of items) {
        if (item.type.indexOf("image") === 0) {
          if (!imagesAllowed) {
            toast.error(`Images are not supported for this model.`)
            return
          }
          const file = item.getAsFile()
          if (file) handleSelectDeviceFile(file)
        }
      }
    },
    [chatSettings?.model, handleSelectDeviceFile]
  )

  const showCommandInput =
    isPromptPickerOpen ||
    isFilePickerOpen ||
    isToolPickerOpen ||
    isAssistantPickerOpen

  return (
    <>
      <audio ref={audioElRef} autoPlay />

      <div className="flex flex-col flex-wrap justify-center gap-2">
        {(context.chatFiles.length > 0 || newMessageImages.length > 0) && (
          <ChatFilesDisplay />
        )}
        {context.selectedTools.length > 0 && <SelectedTools />}
        {selectedAssistant && <SelectedAssistant />}
      </div>

      <div className="border-input relative mt-3 flex min-h-[60px] w-full items-center justify-center rounded-xl border-2">
        {showCommandInput && (
          <div className="absolute bottom-[76px] left-0 max-h-[300px] w-full overflow-auto rounded-xl dark:border-none">
            <ChatCommandInput />
          </div>
        )}

        <>
          <IconCirclePlus
            className="absolute bottom-[12px] left-3 cursor-pointer p-1 hover:opacity-50"
            size={32}
            onClick={() => fileInputRef.current?.click()}
          />
          <Input
            ref={fileInputRef}
            className="hidden"
            type="file"
            onChange={e => {
              if (e.target.files) handleSelectDeviceFile(e.target.files[0])
            }}
            accept={filesToAccept}
          />
        </>

        <TextareaAutosize
          textareaRef={chatInputRef}
          className="font-vazir ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring text-md flex w-full resize-none rounded-md border-none bg-transparent px-14 py-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={`Ask anything. Type @ / # !`}
          onValueChange={handleInputChange}
          value={userInput}
          minRows={1}
          maxRows={18}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsTyping(true)}
          onCompositionEnd={() => setIsTyping(false)}
        />

        <div className="absolute bottom-2.5 right-12">
          {isRealtimeConnecting ? (
            <IconLoader2
              className="text-muted-foreground animate-spin"
              size={28}
            />
          ) : isRealtimeConnected ? (
            <IconPlayerRecordFilled
              className="cursor-pointer rounded p-1 text-red-500 hover:opacity-80"
              size={28}
              onClick={handleToggleRealtime}
            />
          ) : (
            <IconMicrophone
              className="bg-primary text-secondary cursor-pointer rounded p-1 hover:opacity-80"
              size={28}
              onClick={handleToggleRealtime}
            />
          )}
        </div>

        <div className="absolute bottom-2.5 right-3">
          {isGenerating ? (
            <IconPlayerStopFilled
              className="hover:bg-background animate-pulse cursor-pointer rounded bg-transparent p-1"
              onClick={handleStopMessage}
              size={30}
            />
          ) : (
            <IconSend
              className={cn(
                "bg-primary text-secondary rounded p-1",
                !userInput ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              )}
              onClick={() => {
                if (!userInput) return

                if (isRealtimeConnected) {
                  sendRealtimeText(userInput)
                } else {
                  handleSendMessage(userInput, chatMessages, false)
                }
              }}
              size={28}
            />
          )}
        </div>
      </div>
    </>
  )
}
