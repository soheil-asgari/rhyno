import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatbotUIContext } from "@/context/context"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { LLM, LLMID, MessageImage, ModelProvider } from "@/types"
import {
  IconBolt,
  IconCaretDownFilled,
  IconCaretRightFilled,
  IconCircleFilled,
  IconDownload,
  IconFileText,
  IconMoodSmile,
  IconPencil,
  IconPlayerPlayFilled,
  IconRefresh
} from "@tabler/icons-react"
import Image from "next/image"
import React, {
  FC,
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react"
// ✨ ایمپورت‌های کامپوننت‌های UI اضافه شد
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import { Button } from "../ui/button"
import { FileIcon } from "../ui/file-icon"
import { FilePreview } from "../ui/file-preview"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { WithTooltip } from "../ui/with-tooltip"
import { MessageActions } from "./message-actions"
import { MessageMarkdown } from "./message-markdown"

const ICON_SIZE = 32

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "💨 Rhyno V1",
  "gpt-3.5-turbo-16k": "💨 Rhyno V1 Pro",
  "gpt-4": "🧠 Rhyno V2",
  "gpt-4-turbo": "⚡ Rhyno V3 Turbo",
  "gpt-4-turbo-preview": "⚡ Rhyno V3 Preview",
  "gpt-4o": "🚀 Rhyno V4 Ultra",
  "gpt-4o-mini": "⚡ Rhyno V4 Mini",
  "gpt-4o-mini-tts": "🎤 Rhyno TTS",
  "gpt-4o-transcribe": "🎙️ Rhyno Transcribe",
  "computer-use-preview": "🖥️ Rhyno Auto",
  "gpt-5": "🌌 Rhyno V5 Ultra",
  "gpt-5-mini": "✨ Rhyno V5 Mini",
  "gpt-5-nano": "🔹 Rhyno V5 Nano",
  "gpt-4o-realtime-preview-2025-06-03": "🎙️ Rhyno Live V1",
  "gpt-4o-mini-realtime-preview-2024-12-17": "🎧 Rhyno Live Mini",
  "dall-e-3": "🎨 Rhyno Image V1",
  "gpt-4.1": "💻 Rhyno Code V1"
}

const MODEL_PROMPTS: Record<string, string> = {
  "gpt-3.5-turbo":
    "You are a friendly, helpful AI assistant. Your name is Rhyno v1",
  "gpt-3.5-turbo-16k":
    "You are a friendly AI with extended memory. Your name is Rhyno v1 Pro",
  "gpt-4": "You are a highly intelligent AI assistant. Your name is Rhyno v2",
  "gpt-4-turbo":
    "You are a faster, cost-efficient AI assistant. Your name is Rhyno v3 Turbo",
  "gpt-4-turbo-preview":
    "You are an experimental fast AI assistant. Your name is Rhyno v3 Preview",
  "gpt-4o":
    "You are a powerful AI assistant with extended reasoning. Your name is Rhyno v4.1",
  "gpt-4o-mini":
    "You are a mini version of AI assistant. Your name is Rhyno v4 mini",
  // "gpt-4o-mini-tts":
  //   "You are Rhyno TTS, an AI that converts text to natural speech",
  // "gpt-4o-transcribe":
  //   "You are Rhyno Transcribe, an AI that converts speech to text accurately",
  "computer-use-preview":
    "You are Rhyno Auto, an AI that can interact with computer interfaces and automate tasks",
  "gpt-5": "You are GPT-5 AI assistant. Your name is Rhyno v5",
  "gpt-5-mini": "You are GPT-5 mini AI assistant. Your name is Rhyno v5 mini",
  "gpt-5-nano": "You are GPT-5 nano AI assistant. Your name is Rhyno v5 nano",
  "gpt-4o-realtime-preview-2025-06-03":
    "You are Rhyno Live, respond in real-time Persian voice and text",
  "gpt-4o-mini-realtime-preview-2024-12-17":
    "You are Rhyno Live Mini, real-time Persian chat assistant",
  "gpt-4.1": "You are Rhyno Code V1, expert in programming and code assistance"
}

// ✨ صداهای موجود برای TTS اضافه شد
const TTS_VOICES = [
  { id: "alloy", name: "Alloy" },
  { id: "echo", name: "Echo" },
  { id: "fable", name: "Fable" },
  { id: "onyx", name: "Onyx" },
  { id: "nova", name: "Nova" },
  { id: "shimmer", name: "Shimmer" },
  { id: "coral", name: "Coral" }
]

const TTS_SPEEDS = [
  { id: 0.75, name: "Slow (0.75x)" },
  { id: 1.0, name: "Normal (1.0x)" },
  { id: 1.25, name: "Fast (1.25x)" },
  { id: 1.5, name: "Very Fast (1.5x)" }
]
// =================================================================
// 1. Helper Components (کامپوننت‌های کمکی)
// =================================================================

const MessageHeader: FC<{
  message: Tables<"messages">
  profile: Tables<"profiles"> | null
  assistantImage?: string
  modelData?: LLM
  assistantName: string
}> = memo(({ message, profile, assistantImage, modelData, assistantName }) => {
  const renderAvatar = () => {
    if (message.role === "assistant") {
      return assistantImage ? (
        <Image
          src={assistantImage}
          alt="assistant image"
          height={ICON_SIZE}
          width={ICON_SIZE}
          loading="lazy"
          className="rounded"
        />
      ) : (
        <WithTooltip
          display={
            <div>
              {MODEL_DISPLAY_NAMES[modelData?.modelId || ""] || "Unknown Model"}
            </div>
          }
          trigger={
            <Image
              src="/rhyno1.png"
              width={ICON_SIZE}
              height={ICON_SIZE}
              loading="lazy"
              alt="Model Icon"
              className="rounded object-cover"
            />
          }
        />
      )
    }
    return profile?.image_url ? (
      <Image
        className="size-[32px] rounded"
        src={profile.image_url}
        height={32}
        loading="lazy"
        width={32}
        alt="user image"
      />
    ) : (
      <IconMoodSmile
        size={ICON_SIZE}
        className="bg-primary text-secondary border-primary rounded border-DEFAULT p-1"
      />
    )
  }

  return (
    <div className="flex items-center space-x-3">
      {renderAvatar()}
      <div className="font-vazir text-sm font-semibold text-[#aaa]">
        {message.role === "assistant"
          ? assistantName
          : profile?.display_name || profile?.username}
      </div>
    </div>
  )
})
MessageHeader.displayName = "MessageHeader"
// ✨ Props کامپوننت MessageBody اصلاح شد
const MessageBody: FC<{
  message: Tables<"messages">
  isEditing: boolean
  isGenerating: boolean
  isLast: boolean
  firstTokenReceived: boolean
  toolInUse: string
  editedMessage: string
  setEditedMessage: (value: string) => void
  editInputRef: React.RefObject<HTMLTextAreaElement>
  onRegenerateTTS: (voice: string) => void
  onDownloadTTS: () => void
  selectedVoice: string
  setSelectedVoice: (voice: string) => void
  selectedSpeed: number
  setSelectedSpeed: (speed: number) => void
}> = memo(
  ({
    message,
    isEditing,
    isGenerating,
    isLast,
    firstTokenReceived,
    toolInUse,
    editedMessage,
    setEditedMessage,
    editInputRef,
    onRegenerateTTS,
    onDownloadTTS,
    selectedVoice,
    setSelectedVoice,
    selectedSpeed,
    setSelectedSpeed
  }) => {
    const content = message.content
    const isTTSMessage = message.model === "gpt-4o-mini-tts"

    const audioSrc =
      isTTSMessage && typeof content === "string" && content.startsWith("blob:")
        ? content
        : null
    console.log(
      `[MessageBody DEBUG] ID: ${message.id}, isTTS: ${isTTSMessage}, Content: "${content}", audioSrc: ${audioSrc}`
    )
    const audioRef = useRef<HTMLAudioElement>(null)

    let isImageResponse = false
    let imageUrl = ""

    // فقط پیام‌های دستیار را بررسی می‌کنیم که از نوع TTS یا base64 نباشند
    if (
      message.role === "assistant" &&
      !isTTSMessage &&
      !content.startsWith("data:image")
    ) {
      try {
        const parsedContent = JSON.parse(content)
        if (parsedContent && parsedContent.imageUrl) {
          isImageResponse = true
          imageUrl = parsedContent.imageUrl
        }
      } catch (error) {
        // اگر محتوا JSON نبود یا کلید imageUrl را نداشت، خطا را نادیده می‌گیریم
        // و به عنوان متن عادی با آن رفتار می‌کنیم.
      }
    }
    // ✨ این شرط را برای نمایش پیام‌های صوتی کاربر اضافه یا اصلاح کنید
    if (message.model === "user-audio") {
      return <audio controls src={message.content} className="w-full" />
    }
    if (
      !firstTokenReceived &&
      isGenerating &&
      isLast &&
      message.role === "assistant" &&
      !isTTSMessage // حالت لودینگ برای پیام‌های غیر TTS
    ) {
      switch (toolInUse) {
        case "retrieval":
          return (
            <div className="flex animate-pulse items-center space-x-2">
              <IconFileText size={20} />
              <div>Searching files...</div>
            </div>
          )
        case "none":
          return <IconCircleFilled className="animate-pulse" size={20} />
        default:
          return (
            <div className="flex animate-pulse items-center space-x-2">
              <IconBolt size={20} />
              <div>Using {toolInUse}...</div>
            </div>
          )
      }
    }

    if (isEditing) {
      return (
        <TextareaAutosize
          textareaRef={editInputRef}
          className="text-md font-vazir text-right text-[15px] leading-relaxed"
          dir="rtl"
          value={editedMessage}
          onValueChange={setEditedMessage}
          maxRows={20}
        />
      )
    }
    if (message.role === "user") {
      return (
        <div className="font-vazir whitespace-pre-wrap text-right text-[15px] leading-relaxed text-white">
          {content}
        </div>
      )
    }

    const isBase64Image =
      typeof content === "string" && content.startsWith("data:image")

    if (isBase64Image) {
      return (
        <div className="relative w-fit">
          <Image
            src={content}
            alt="Uploaded content"
            width={512}
            height={512}
            className="rounded-lg object-contain"
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 top-2"
            onClick={() => {
              const a = document.createElement("a")
              a.href = content
              a.download = `image-${Date.now()}.png`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
            }}
            title="دانلود تصویر"
          >
            <IconDownload />
          </Button>
        </div>
      )
    }
    if (isImageResponse) {
      return (
        <div className="relative w-fit">
          <Image
            src={imageUrl}
            alt="Generated by DALL-E"
            width={512}
            height={512}
            className="rounded-lg object-contain"
            loading="lazy"
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-2 top-2"
            onClick={() => {
              const a = document.createElement("a")
              a.href = imageUrl
              a.download = `image-${Date.now()}.png`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
            }}
            title="دانلود تصویر"
          >
            <IconDownload />
          </Button>
        </div>
      )
    }

    if (isTTSMessage) {
      if (isGenerating && isLast) {
        return (
          <div className="text-yellow-400">⏳ DEBUG: در حال ساخت صدا...</div>
        )
      }
      if (audioSrc) {
        return (
          <div className="flex flex-col space-y-4">
            {audioSrc && (
              <audio
                ref={audioRef}
                controls
                src={audioSrc}
                className="w-full"
              ></audio>
            )}
            <div className="flex items-center space-x-2">
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger className="font-vazir w-[180px] text-right">
                  <SelectValue placeholder="انتخاب صدا" />
                </SelectTrigger>
                <SelectContent>
                  {TTS_VOICES.map(voice => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(selectedSpeed)}
                onValueChange={value => setSelectedSpeed(parseFloat(value))}
              >
                <SelectTrigger className="font-vazir w-[180px] text-right">
                  <SelectValue placeholder="انتخاب سرعت" />
                </SelectTrigger>
                <SelectContent>
                  {TTS_SPEEDS.map(speed => (
                    <SelectItem key={speed.id} value={String(speed.id)}>
                      {speed.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRegenerateTTS(selectedVoice)}
                title="ساخت دوباره"
              >
                <IconRefresh />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={onDownloadTTS}
                title="دانلود"
              >
                <IconDownload />
              </Button>
            </div>
          </div>
        )
      }

      return (
        <MessageMarkdown
          content={content}
          className="markdown-content-rtl message-line-height whitespace-pre-wrap text-right tracking-normal text-white"
          dir="rtl"
        />
      )
    }

    return (
      <MessageMarkdown
        content={content}
        className="markdown-content-rtl message-line-height whitespace-pre-wrap text-right tracking-normal text-white"
        dir="rtl"
      />
    )
  }
)
MessageBody.displayName = "MessageBody"

const MessageSources: FC<{
  fileItems: Tables<"file_items">[]
  fileSummary: Record<string, any>
  onFileItemClick: (fileItem: Tables<"file_items">) => void
}> = memo(({ fileItems, fileSummary, onFileItemClick }) => {
  const [viewSources, setViewSources] = useState(false)
  const sourceCount = fileItems.length
  if (sourceCount === 0) return null
  const fileCount = Object.keys(fileSummary).length

  return (
    <div className="border-primary mt-6 border-t pt-4 font-bold">
      <div
        className="flex cursor-pointer items-center text-lg hover:opacity-50"
        onClick={() => setViewSources(v => !v)}
      >
        {sourceCount} {sourceCount > 1 ? "Sources" : "Source"} from {fileCount}{" "}
        {fileCount > 1 ? "Files" : "File"}
        {viewSources ? (
          <IconCaretDownFilled className="ml-1" />
        ) : (
          <IconCaretRightFilled className="ml-1" />
        )}
      </div>

      {viewSources && (
        <div className="mt-3 space-y-4">
          {Object.values(fileSummary).map((file: any) => (
            <div key={file.id}>
              <div className="flex items-center space-x-2">
                <FileIcon type={file.type} />
                <div className="truncate">{file.name}</div>
              </div>
              {fileItems
                .filter(item => item.file_id === file.id)
                .map((item, index) => (
                  <div
                    key={index}
                    className="ml-8 mt-1.5 flex cursor-pointer items-center space-x-2 hover:opacity-50"
                    onClick={() => onFileItemClick(item)}
                  >
                    <div className="text-sm font-normal">
                      <span className="mr-1 text-lg font-bold">-</span>{" "}
                      {item.content.substring(0, 200)}...
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
MessageSources.displayName = "MessageSources"

const MessageImages: FC<{
  message: Tables<"messages">
  chatImages: MessageImage[]
  onImageClick: (image: MessageImage) => void
}> = memo(({ message, chatImages, onImageClick }) => {
  if (!message.image_paths || message.image_paths.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {message.image_paths.map((path, index) => {
        const item = chatImages.find(image => image.path === path)
        const src = path.startsWith("data") ? path : item?.base64 || ""
        return (
          <Image
            key={index}
            className="cursor-pointer rounded hover:opacity-50"
            src={src}
            alt="message image"
            width={300}
            height={300}
            loading="lazy"
            onClick={() =>
              onImageClick({
                messageId: message.id,
                path,
                base64: src,
                url: path.startsWith("data") ? "" : item?.url || "",
                file: null
              })
            }
          />
        )
      })}
    </div>
  )
})
MessageImages.displayName = "MessageImages"

// =================================================================
// 2. Main Component (کامپوننت اصلی)
// =================================================================

interface MessageProps {
  message: Tables<"messages">
  fileItems: Tables<"file_items">[]
  isEditing: boolean
  isLast: boolean
  onStartEdit: (message: Tables<"messages">) => void
  onCancelEdit: () => void
  onSubmitEdit: (value: string, sequenceNumber: number) => void
}

export const Message: FC<MessageProps> = ({
  message,
  fileItems,
  isEditing,
  isLast,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit
}) => {
  const {
    assistants,
    profile,
    isGenerating,
    setIsGenerating,
    firstTokenReceived,
    availableLocalModels,
    availableOpenRouterModels,
    chatMessages,
    setChatMessages, // ✨ اضافه شد
    selectedAssistant,
    chatImages,
    assistantImages,
    toolInUse,
    files,
    models
  } = useContext(ChatbotUIContext)

  const { handleSendMessage } = useChatHandler()
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const [isHovering, setIsHovering] = useState(false)
  const [editedMessage, setEditedMessage] = useState(message.content)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(null)
  const [showFileItemPreview, setShowFileItemPreview] = useState(false)
  const [selectedFileItem, setSelectedFileItem] =
    useState<Tables<"file_items"> | null>(null)

  // ✨ وضعیت و رفرنس برای مدیریت فایل صوتی اضافه شد
  const [selectedVoice, setSelectedVoice] = useState<string>("coral")
  const [selectedSpeed, setSelectedSpeed] = useState<number>(1.0)

  const modelData = useMemo(
    () =>
      [
        ...models.map(model => ({
          modelId: model.model_id as LLMID,
          modelName: model.name,
          provider: "custom" as ModelProvider,
          hostedId: model.id,
          platformLink: "",
          imageInput: false
        })),
        ...LLM_LIST,
        ...availableLocalModels,
        ...availableOpenRouterModels
      ].find(llm => llm.modelId === message.model) as LLM,
    [models, availableLocalModels, availableOpenRouterModels, message.model]
  )

  const assistantName = useMemo(() => {
    const assistant = assistants.find(a => a.id === message.assistant_id)
    return assistant
      ? assistant.name
      : selectedAssistant?.name ||
          MODEL_DISPLAY_NAMES[modelData?.modelId] ||
          modelData?.modelName
  }, [assistants, selectedAssistant, modelData, message.assistant_id])

  const messageAssistantImage = useMemo(
    () =>
      assistantImages.find(image => image.assistantId === message.assistant_id)
        ?.base64,
    [assistantImages, message.assistant_id]
  )

  const fileSummary = useMemo(
    () =>
      fileItems.reduce<Record<string, any>>((acc, fileItem) => {
        const parentFile = files.find(file => file.id === fileItem.file_id)
        if (parentFile) {
          if (!acc[parentFile.id]) {
            acc[parentFile.id] = {
              id: parentFile.id,
              name: parentFile.name,
              count: 1,
              type: parentFile.type,
              description: parentFile.description
            }
          } else {
            acc[parentFile.id].count++
          }
        }
        return acc
      }, {}),
    [fileItems, files]
  )

  const handleCopy = () => {
    if (message.model === "gpt-4o-mini-tts") {
      // برای پیام‌های صوتی، آخرین پیام کاربر را کپی می‌کنیم
      const lastUserMessage = chatMessages.findLast(
        m => m.message.role === "user"
      )
      if (lastUserMessage) {
        navigator.clipboard.writeText(lastUserMessage.message.content)
      }
    } else {
      navigator.clipboard.writeText(message.content)
    }
  }

  const handleSendEdit = () => {
    onSubmitEdit(editedMessage, message.sequence_number)
    onCancelEdit()
  }
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isEditing && event.key === "Enter" && event.metaKey) handleSendEdit()
  }

  // ✨ تابع ساخت مجدد صدا
  const handleRegenerateTTS = async (
    voiceId: string = selectedVoice,
    speedValue: number = selectedSpeed
  ) => {
    setIsGenerating(true)
    const lastUserMessage = chatMessages.findLast(
      m => m.message.role === "user"
    )
    if (!lastUserMessage) {
      console.error("No user message found to regenerate speech.")
      setIsGenerating(false)
      return
    }

    try {
      const response = await fetch("/api/chat/openai", {
        /* ... (بدون تغییر) */
      })
      if (!response.ok) throw new Error("Failed to regenerate audio.")

      const audioBlob = await response.blob()
      const newAudioUrl = URL.createObjectURL(audioBlob)

      // ❌ این دو خط رو حذف کنید چون state و ref حذف شدن
      // setAudioUrl(newAudioUrl)
      // audioUrlRef.current = newAudioUrl

      // ✅ این بخش درسته و باقی می‌مونه
      setChatMessages(prev =>
        prev.map(chatMsg =>
          chatMsg.message.id === message.id
            ? {
                ...chatMsg,
                message: { ...chatMsg.message, content: newAudioUrl }
              }
            : chatMsg
        )
      )
    } catch (error) {
      console.error("Error regenerating TTS:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  // ✨ در handleDownloadTTS
  const handleDownloadTTS = () => {
    // مستقیماً از message.content استفاده می‌کنیم
    const url = message.content
    if (!url || !url.startsWith("blob:")) return

    const a = document.createElement("a")
    a.href = url
    a.download = `rhyno-tts-${Date.now()}.mp3`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleFileItemClick = (fileItem: Tables<"file_items">) => {
    setSelectedFileItem(fileItem)
    setShowFileItemPreview(true)
  }

  const handleImageClick = (image: MessageImage) => {
    setSelectedImage(image)
    setShowImagePreview(true)
  }

  return (
    <div
      className="flex w-full justify-center px-4 py-3 transition-colors duration-200"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          "relative w-full max-w-2xl transition-all duration-200",
          message.role === "user"
            ? "border-border rounded-xl border bg-[hsl(var(--muted))] px-6 py-5 text-[hsl(var(--foreground))]"
            : "assistant-message border-none bg-transparent px-0 py-2",
          message.model === "gpt-4o-mini-tts" && "px-6 py-5" // استایل بهتر برای پیام صوتی
        )}
      >
        <div className="absolute right-5 top-7 sm:right-0">
          <MessageActions
            onCopy={handleCopy}
            onEdit={() => onStartEdit(message)}
            isAssistant={message.role === "assistant"}
            isLast={isLast}
            isEditing={isEditing}
            isHovering={isHovering}
            onRegenerate={handleRegenerateTTS}
          />
        </div>

        <div className="space-y-3">
          <MessageHeader
            message={message}
            profile={profile}
            assistantImage={messageAssistantImage}
            modelData={modelData}
            assistantName={assistantName}
          />
          <MessageBody
            message={message}
            isEditing={isEditing}
            isGenerating={isGenerating}
            isLast={isLast}
            firstTokenReceived={firstTokenReceived}
            toolInUse={toolInUse}
            editedMessage={editedMessage}
            setEditedMessage={setEditedMessage}
            editInputRef={editInputRef}
            selectedSpeed={selectedSpeed}
            setSelectedSpeed={setSelectedSpeed}
            // ✨ Props مربوط به TTS پاس داده شد
            onRegenerateTTS={handleRegenerateTTS}
            onDownloadTTS={handleDownloadTTS}
            selectedVoice={selectedVoice}
            setSelectedVoice={setSelectedVoice}
          />
        </div>

        <MessageSources
          fileItems={fileItems}
          fileSummary={fileSummary}
          onFileItemClick={handleFileItemClick}
        />

        <MessageImages
          message={message}
          chatImages={chatImages}
          onImageClick={handleImageClick}
        />

        {isEditing && (
          <div className="mt-4 flex justify-center space-x-2">
            <Button size="sm" onClick={handleSendEdit}>
              Save & Send
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {showImagePreview && selectedImage && (
        <FilePreview
          type="image"
          item={selectedImage}
          isOpen={showImagePreview}
          onOpenChange={isOpen =>
            !isOpen && (setShowImagePreview(false), setSelectedImage(null))
          }
        />
      )}

      {showFileItemPreview && selectedFileItem && (
        <FilePreview
          type="file_item"
          item={selectedFileItem}
          isOpen={showFileItemPreview}
          onOpenChange={isOpen =>
            !isOpen &&
            (setShowFileItemPreview(false), setSelectedFileItem(null))
          }
        />
      )}
    </div>
  )
}
