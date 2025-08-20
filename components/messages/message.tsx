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
  IconFileText,
  IconMoodSmile,
  IconPencil
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
import { ModelIcon } from "../models/model-icon"
import { Button } from "../ui/button"
import { FileIcon } from "../ui/file-icon"
import { FilePreview } from "../ui/file-preview"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { WithTooltip } from "../ui/with-tooltip"
import { MessageActions } from "./message-actions"
import { MessageMarkdown } from "./message-markdown"

const ICON_SIZE = 32

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "Rhyno v1",
  "gpt-4": "Rhyno v2",
  "gpt-4-turbo-preview": "Rhyno v3",
  "gpt-5": "Rhyno v5",
  "gpt-5-mini": "Rhyno v5 mini",
  "gpt-4o": "Rhyno v4.1",
  "gpt-4o-mini": "Rhyno v4 mini",
  "dall-e-3": "Rhyno Image"
}

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
              src="/rhyno.jpg"
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
    editInputRef
  }) => {
    // ---- شروع تغییرات ----

    // ابتدا بررسی می‌کنیم که در حال لودینگ یا ویرایش نباشیم
    if (
      !firstTokenReceived &&
      isGenerating &&
      isLast &&
      message.role === "assistant"
    ) {
      // ... (این بخش کد شما برای نمایش حالت لودینگ بدون تغییر باقی می‌ماند)
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
      // ... (این بخش کد شما برای ویرایش هم بدون تغییر باقی می‌ماند)
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

    // ⭐ منطق اصلی اینجاست ⭐
    const content = message.content
    const isBase64Image =
      typeof content === "string" && content.startsWith("data:image")

    if (isBase64Image) {
      // اگر محتوا عکس بود، کامپوننت Image نکست را نمایش بده
      return (
        <Image
          src={content}
          alt="Uploaded content"
          width={512} // می‌توانید اندازه را به دلخواه تغییر دهید
          height={512}
          className="rounded-lg object-contain"
        />
      )
    }

    // در غیر این صورت، محتوا را به عنوان مارک‌داون نمایش بده
    return (
      <MessageMarkdown
        content={content}
        className="markdown-content-rtl message-line-height whitespace-pre-wrap text-right tracking-normal text-white"
        dir="rtl"
      />
    )

    // ---- پایان تغییرات ----
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
  const fileCount = Object.keys(fileSummary).length

  if (sourceCount === 0) return null

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
  if (message.image_paths.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {message.image_paths.map((path, index) => {
        const item = chatImages.find(image => image.path === path)
        console.log("message.image_paths:", message.image_paths)
        console.log("chatImages:", chatImages)

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

  const handleCopy = () => navigator.clipboard.writeText(message.content)
  const handleSendEdit = () => {
    onSubmitEdit(editedMessage, message.sequence_number)
    onCancelEdit()
  }
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isEditing && event.key === "Enter" && event.metaKey) handleSendEdit()
  }
  const handleRegenerate = async () => {
    setIsGenerating(true)
    await handleSendMessage(
      editedMessage || chatMessages[chatMessages.length - 2].message.content,
      chatMessages,
      true
    )
  }

  // Define the click handlers for file items and images
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
            : "assistant-message border-none bg-transparent px-0 py-2"
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
            onRegenerate={handleRegenerate}
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
