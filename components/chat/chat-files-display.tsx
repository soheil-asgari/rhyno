// فایل: ChatFilesDisplay.tsx (نسخه اصلاح شده)

import { ChatbotUIContext } from "@/context/context"
import { getFileFromStorage } from "@/db/storage/files"
import useHotkey from "@/lib/hooks/use-hotkey"
import { cn } from "@/lib/utils"
import { ChatFile, MessageImage } from "@/types"
import {
  IconCircleFilled,
  IconFileFilled,
  IconFileTypeCsv,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileTypeTxt,
  IconJson,
  IconLoader2,
  IconMarkdown,
  IconX
} from "@tabler/icons-react"
import Image from "next/image"
import { FC, useContext, useState } from "react"
import { Button } from "../ui/button"
import { FilePreview } from "../ui/file-preview"
import { WithTooltip } from "../ui/with-tooltip"
import { ChatRetrievalSettings } from "./chat-retrieval-settings"

interface ChatFilesDisplayProps {}

export const ChatFilesDisplay: FC<ChatFilesDisplayProps> = ({}) => {
  useHotkey("f", () => setShowFilesDisplay(prev => !prev))
  useHotkey("e", () => setUseRetrieval(prev => !prev))

  const {
    files,
    newMessageImages,
    setNewMessageImages,
    newMessageFiles,
    setNewMessageFiles,
    setShowFilesDisplay,
    showFilesDisplay,
    chatFiles,
    chatImages,
    setChatImages,
    setChatFiles,
    setUseRetrieval
  } = useContext(ChatbotUIContext)
  console.log(
    "%c--- ChatFilesDisplay Component Rendered ---",
    "color: orange; font-weight: bold;"
  )
  console.log(
    "1. State right after render -> newMessageFiles:",
    newMessageFiles
  )
  console.log("2. State right after render -> chatFiles:", chatFiles)

  const [selectedFile, setSelectedFile] = useState<ChatFile | null>(null)
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const messageImages = [
    ...newMessageImages.filter(
      image =>
        !chatImages.some(chatImage => chatImage.messageId === image.messageId)
    )
  ]

  const combinedChatFiles = [
    ...newMessageFiles.filter(
      file => !chatFiles.some(chatFile => chatFile.id === file.id)
    ),
    ...chatFiles
  ]

  const combinedMessageFiles = [...messageImages, ...combinedChatFiles]

  const getLinkAndView = async (file: ChatFile) => {
    const fileRecord = files.find(f => f.id === file.id)

    if (!fileRecord) return

    const link = await getFileFromStorage(fileRecord.file_path)
    window.open(link, "_blank")
  }
  // ================= START: لاگ‌های جدید را اینجا اضافه کنید =================
  console.log(
    "3. Calculated array to be rendered -> combinedChatFiles:",
    combinedChatFiles
  )
  console.log("4. Condition check -> showFilesDisplay:", showFilesDisplay)
  console.log(
    "5. Condition check -> combinedMessageFiles.length:",
    combinedMessageFiles.length
  )
  // ================= END: پایان لاگ‌های جدید =================

  return showFilesDisplay && combinedMessageFiles.length > 0 ? (
    <>
      {showPreview && selectedImage && (
        <FilePreview
          type="image"
          item={selectedImage}
          isOpen={showPreview}
          onOpenChange={(isOpen: boolean) => {
            setShowPreview(isOpen)
            setSelectedImage(null)
          }}
        />
      )}

      {showPreview && selectedFile && (
        <FilePreview
          type="file"
          item={selectedFile}
          isOpen={showPreview}
          onOpenChange={(isOpen: boolean) => {
            setShowPreview(isOpen)
            setSelectedFile(null)
          }}
        />
      )}

      <div className="space-y-2">
        <div className="flex w-full items-center justify-center">
          <Button
            className="flex h-[32px] w-[140px] space-x-2"
            onClick={() => setShowFilesDisplay(false)}
          >
            <RetrievalToggle />
            <div>Hide files</div>
            <div onClick={e => e.stopPropagation()}>
              <ChatRetrievalSettings />
            </div>
          </Button>
        </div>

        <div className="overflow-auto">
          <div className="flex gap-2 overflow-auto pt-2">
            {messageImages.map((image, index) => {
              const imageUrl = image.url
              if (!imageUrl) return null

              const isLocalPreview = imageUrl.startsWith("blob:")

              return (
                <div
                  key={image.path || index}
                  className="relative flex size-[56px] cursor-pointer items-center justify-center rounded-xl hover:opacity-50"
                  onClick={() => {
                    setSelectedImage(image)
                    setShowPreview(true)
                  }}
                >
                  {isLocalPreview ? (
                    <img
                      src={imageUrl}
                      alt="File preview"
                      className="rounded"
                      style={{
                        width: "56px",
                        height: "56px",
                        objectFit: "cover"
                      }}
                    />
                  ) : (
                    <Image
                      src={imageUrl}
                      alt="File preview"
                      width={56}
                      height={56}
                      className="rounded"
                      style={{ objectFit: "cover" }}
                    />
                  )}

                  <IconX
                    className="bg-muted-foreground border-primary absolute right-[-6px] top-[-2px] flex size-5 cursor-pointer items-center justify-center rounded-full border-DEFAULT text-[10px] hover:border-red-500 hover:bg-white hover:text-red-500"
                    onClick={e => {
                      e.stopPropagation()
                      setNewMessageImages(
                        newMessageImages.filter(
                          f => f.messageId !== image.messageId
                        )
                      )
                    }}
                  />

                  {image.path === "uploading..." && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black bg-opacity-50">
                      <IconLoader2 className="size-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
              )
            })}
            {/* تا اینجا */}
            {combinedChatFiles.map((file, index) =>
              file.id === "loading" ? (
                <div
                  key={index}
                  className="relative flex h-[64px] items-center space-x-4 rounded-xl border-2 px-4 py-3"
                >
                  <div className="rounded bg-blue-500 p-2">
                    <IconLoader2 className="animate-spin" />
                  </div>
                  <div className="truncate text-sm">
                    <div className="truncate">{file.name}</div>
                    <div className="truncate opacity-50">{file.type}</div>
                  </div>
                </div>
              ) : (
                <div
                  key={file.id}
                  className="relative flex h-[64px] cursor-pointer items-center space-x-4 rounded-xl border-2 px-4 py-3 hover:opacity-50"
                  onClick={() => getLinkAndView(file)}
                >
                  {/* START: بخش اصلاح شده برای نمایش پیش‌نمایش */}
                  {file.preview && file.preview.startsWith("data:image/") ? (
                    <img
                      src={file.preview || ""}
                      alt={`Preview of ${file.name}`}
                      className="rounded"
                      style={{
                        width: "40px",
                        height: "40px",
                        objectFit: "cover"
                      }}
                    />
                  ) : (
                    <div className="rounded bg-blue-500 p-2">
                      {(() => {
                        let fileExtension = file.type.includes("/")
                          ? file.type.split("/")[1]
                          : file.type

                        switch (fileExtension) {
                          case "pdf":
                            return <IconFileTypePdf />
                          case "markdown":
                            return <IconMarkdown />
                          case "txt":
                            return <IconFileTypeTxt />
                          case "json":
                            return <IconJson />
                          case "csv":
                            return <IconFileTypeCsv />
                          case "vnd.openxmlformats-officedocument.wordprocessingml.document":
                            return <IconFileTypeDocx />
                          default:
                            return <IconFileFilled />
                        }
                      })()}
                    </div>
                  )}
                  {/* END: پایان بخش اصلاح شده */}

                  <div className="truncate text-sm">
                    <div className="truncate">{file.name}</div>
                  </div>

                  <IconX
                    className="bg-muted-foreground border-primary absolute right-[-6px] top-[-6px] flex size-5 cursor-pointer items-center justify-center rounded-full border-DEFAULT text-[10px] hover:border-red-500 hover:bg-white hover:text-red-500"
                    onClick={e => {
                      e.stopPropagation()
                      setNewMessageFiles(
                        newMessageFiles.filter(f => f.id !== file.id)
                      )
                      setChatFiles(chatFiles.filter(f => f.id !== file.id))
                    }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  ) : (
    combinedMessageFiles.length > 0 && (
      <div className="flex w-full items-center justify-center space-x-2">
        <Button
          className="flex h-[32px] w-[140px] space-x-2"
          onClick={() => setShowFilesDisplay(true)}
        >
          <RetrievalToggle />
          <div>
            {" "}
            View {combinedMessageFiles.length} file
            {combinedMessageFiles.length > 1 ? "s" : ""}
          </div>
          <div onClick={e => e.stopPropagation()}>
            <ChatRetrievalSettings />
          </div>
        </Button>
      </div>
    )
  )
}

// ... بقیه کد بدون تغییر ...
const RetrievalToggle = ({}) => {
  const { useRetrieval, setUseRetrieval } = useContext(ChatbotUIContext)

  return (
    <div className="flex items-center">
      <WithTooltip
        delayDuration={0}
        side="top"
        display={
          <div>
            {useRetrieval
              ? "File retrieval is enabled on the selected files for this message. Click the indicator to disable."
              : "Click the indicator to enable file retrieval for this message."}
          </div>
        }
        trigger={
          <IconCircleFilled
            className={cn(
              "p-1",
              useRetrieval ? "text-green-500" : "text-red-500",
              useRetrieval ? "hover:text-green-200" : "hover:text-red-200"
            )}
            size={24}
            onClick={e => {
              e.stopPropagation()
              setUseRetrieval(prev => !prev)
            }}
          />
        }
      />
    </div>
  )
}
