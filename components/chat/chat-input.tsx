"use client"

import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { useVoiceRecorder } from "./chat-hooks/use-voice-recorder"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import {
  IconCirclePlus,
  IconLoader2,
  IconMicrophone,
  IconPlayerRecordFilled,
  IconPlayerStopFilled,
  IconSend
} from "@tabler/icons-react"
import dynamic from "next/dynamic"
// --- 👇 ایمپورت‌های مورد نیاز اضافه شدند ---
import { FC, useCallback, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Input } from "../ui/input"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { useChatHandler } from "./chat-hooks/use-chat-handler"
// --- ⛔️ ایمپورت usePromptAndCommand حذف شد ---
import { useSelectFileHandler } from "./chat-hooks/use-select-file-handler"

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
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // این کد در زمان بارگذاری کامپوننت، نوع دستگاه را تشخیص می‌دهد
    const userAgent =
      typeof window.navigator === "undefined" ? "" : navigator.userAgent
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent)
    setIsMobile(mobile)
  }, [])
  const {
    userInput,
    setUserInput, // 👈 ۱. ما 'userInput' (گلوبال) را فقط برای خواندن اولیه لازم داریم
    selectedChat,
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
    newMessageImages,
    newMessageFiles
  } = useContext(ChatbotUIContext)

  const [localInput, setLocalInput] = useState(userInput)

  useEffect(() => {
    // هر تغییری در state گلوبال باید state محلی را آپدیت کند
    // (این هم شامل پاک شدن بعد از ارسال، و هم بازیابی متن در صورت خطاست)
    if (userInput !== localInput) {
      setLocalInput(userInput)
    }
  }, [userInput])

  useEffect(() => {
    if (!selectedChat) {
      setLocalInput("")
      // ما استیت گلوبال را هم برای اطمینان پاک می‌کنیم
      setUserInput("")
    }
  }, [selectedChat, setUserInput])

  const {
    chatInputRef,
    handleSendMessage,
    handleStopMessage,
    handleFocusChatInput,
    setChatMessages
  } = useChatHandler()
  console.log("ChatInput render - chatSettings.model:", chatSettings?.model)

  // ✨ تابع جدید و هوشمند برای مدیریت دو سناریوی صوتی
  const handleVoiceSubmit = async (audioBlob: Blob) => {
    const selectedModel = chatSettings?.model
    setIsTranscribing(true)

    // سناریو ۲: اگر مدل "رونویسی" انتخاب شده بود
    if (selectedModel === "gpt-4o-transcribe") {
      // ... (منطق رونویسی شما - بدون تغییر)
      const audioUrl = URL.createObjectURL(audioBlob)

      const userAudioMessage: Tables<"messages"> = {
        id: crypto.randomUUID(),
        chat_id: chatMessages[0]?.message.chat_id || "",
        user_id: chatMessages[0]?.message.user_id || "",
        assistant_id: null,
        content: audioUrl,
        file_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        image_paths: [],
        model: "user-audio",
        role: "user",
        sequence_number: chatMessages.length,
        audio_url: ""
      }
      setChatMessages(prev => [
        ...prev,
        { message: userAudioMessage, fileItems: [] }
      ])

      const formData = new FormData()
      formData.append("file", audioBlob, "recording.webm")
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      })
      const result = await response.json()

      if (response.ok && result.text) {
        const assistantTextMessage: Tables<"messages"> = {
          id: crypto.randomUUID(),
          chat_id: chatMessages[0]?.message.chat_id || "",
          file_url: null,
          user_id: chatMessages[0]?.message.user_id || "",
          assistant_id: null,
          content: result.text,
          created_at: new Date().toISOString(),
          image_paths: [],
          model: selectedModel,
          role: "assistant",
          sequence_number: chatMessages.length + 1,
          updated_at: new Date().toISOString(),
          audio_url: ""
        }
        setChatMessages(prev => [
          ...prev,
          { message: assistantTextMessage, fileItems: [] }
        ])
      } else {
        toast.error(result.message || "خطا در رونویسی صدا")
      }
    }
    // سناریو ۱: برای بقیه مدل‌ها (ارسال خودکار)
    else {
      const formData = new FormData()
      formData.append("file", audioBlob, "recording.webm")
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      })
      const result = await response.json()

      if (response.ok && result.text) {
        // تابع handleSendMessage خودش state گلوبال را پاک می‌کند
        // و useEffect ما در بالا، state محلی را پاک خواهد کرد.
        handleSendMessage(result.text, chatMessages, false)
      } else {
        toast.error(result.message || "خطا در رونویسی صدا")
      }
    }
    setIsTranscribing(false)
  }

  const { isRecording, handleToggleRecording } =
    useVoiceRecorder(handleVoiceSubmit)

  useHotkey("l", () => handleFocusChatInput())
  const { handleSelectFile, filesToAccept } = useSelectFileHandler()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // 👇 ==== اصلاح اصلی اینجاست ==== 👇
    // فقط در صورتی فوکوس کن که عرض صفحه بزرگتر از 768 پیکسل (دسکتاپ) باشد
    if (window.innerWidth > 768) {
      const timer = setTimeout(() => {
        handleFocusChatInput()
      }, 200)
      return () => clearTimeout(timer)
    }
    // وابستگی‌ها تغییر نمی‌کند
  }, [selectedPreset, selectedAssistant, handleFocusChatInput])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (
        !isMobile && // <--- این شرط جدید اضافه شده است
        !isTyping &&
        event.key === "Enter" &&
        !event.shiftKey &&
        !isRecording
      ) {
        event.preventDefault()
        setIsPromptPickerOpen(false)
        if (localInput) {
          // 👇 --- ۳. قبل از ارسال، state گلوبال را آپدیت کن ---
          setUserInput(localInput)
          handleSendMessage(localInput, chatMessages, false)
          setLocalInput("")
        }
      }
    },
    [
      isMobile, // <--- isMobile را به اینجا هم اضافه کنید
      isTyping,
      localInput, // 👈 اصلاح شده: به localInput (محلی) وابسته شود
      chatMessages,
      isRecording,
      handleSendMessage,
      setIsPromptPickerOpen,
      setUserInput
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
          if (file) handleSelectFile(file)
        }
      }
    },
    [chatSettings?.model, handleSelectFile]
  )

  const showCommandInput =
    isPromptPickerOpen ||
    isFilePickerOpen ||
    isToolPickerOpen ||
    isAssistantPickerOpen

  return (
    <>
      <div className="flex flex-col flex-wrap justify-center gap-2">
        {(newMessageFiles.length > 0 || newMessageImages.length > 0) && (
          <ChatFilesDisplay />
        )}
        {selectedAssistant && <SelectedAssistant />}
      </div>

      <div className="border-input relative flex min-h-[60px] w-full items-center rounded-xl border-2 pb-[env(safe-area-inset-bottom)]">
        {showCommandInput && (
          <div className="absolute bottom-[76px] left-0 max-h-[300px] w-full overflow-auto rounded-xl dark:border-none">
            <ChatCommandInput />
          </div>
        )}

        <>
          <IconCirclePlus
            className="absolute bottom-2.5 left-3 cursor-pointer p-1 hover:opacity-50"
            size={32}
            onClick={() => fileInputRef.current?.click()}
          />
          <Input
            ref={fileInputRef}
            className="hidden"
            type="file"
            onChange={e => {
              if (!e.target.files) return
              const file = e.target.files[0]

              // بررسی می‌کنیم که فایل صوتی است یا نه
              if (file.type.startsWith("audio/")) {
                // اگر صوتی بود، برای رونویسی ارسال می‌شود
                handleVoiceSubmit(file)
              } else {
                // در غیر این صورت، مانند قبل برای الصاق فایل پردازش می‌شود
                handleSelectFile(file)
              }

              // input را خالی می‌کنیم تا بتوان دوباره همان فایل را انتخاب کرد
              e.target.value = ""
            }}
            // لیست فایل‌های مجاز را به‌روزرسانی کنید
            accept={filesToAccept + ",audio/*"}
          />
        </>
        <form autoComplete="off" className="flex w-full">
          <TextareaAutosize
            textareaRef={chatInputRef}
            className="font-vazir ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring text-md flex w-full min-w-0 resize-none rounded-md border-none bg-transparent py-3 pl-14 pr-24 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="پیام خود را تایپ یا ضبط کنید..."
            // --- 👇 تغییر اصلی اینجاست ---
            onValueChange={setLocalInput}
            value={localInput}
            autoComplete="new-password"
            minRows={1}
            maxRows={18}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={() => setIsTyping(true)}
            onCompositionEnd={() => setIsTyping(false)}
          />
        </form>
        <div className="absolute bottom-2.5 right-12">
          {isTranscribing ? (
            <IconLoader2
              className="text-muted-foreground animate-spin"
              size={28}
            />
          ) : isRecording ? (
            <IconPlayerRecordFilled
              className="cursor-pointer rounded p-1 text-red-500 hover:opacity-80"
              size={28}
              onClick={handleToggleRecording}
            />
          ) : (
            <IconMicrophone
              className="bg-primary text-secondary cursor-pointer rounded p-1 hover:opacity-80"
              size={28}
              onClick={handleToggleRecording}
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

                // --- 👇 --- ۵. دکمه ارسال را به userInput گلوبال وابسته کنید ---
                !localInput || isRecording
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer"
              )}
              onClick={() => {
                if (!localInput || isRecording) return
                // 👇 --- ۵. قبل از ارسال، state گلوبال را آپدیت کن ---
                setUserInput(localInput)
                handleSendMessage(localInput, chatMessages, false)
                setLocalInput("")
                // --- 👆 پایان تغییر ۵ ---
              }}
              size={28}
            />
          )}
        </div>
      </div>
    </>
  )
}
