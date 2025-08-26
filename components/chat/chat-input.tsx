"use client"

import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import {
  IconBolt,
  IconCirclePlus,
  IconPlayerStopFilled,
  IconSend
} from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import dynamic from "next/dynamic"

import { Input } from "../ui/input"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { useChatHandler } from "./chat-hooks/use-chat-handler"
import { useChatHistoryHandler } from "./chat-hooks/use-chat-history"
import { usePromptAndCommand } from "./chat-hooks/use-prompt-and-command"
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
  const { t } = useTranslation()
  const [isTyping, setIsTyping] = useState<boolean>(false)

  // ✨ FIX: Move useChatHandler hook to the top of the component
  const {
    chatInputRef,
    handleSendMessage,
    handleStopMessage,
    handleFocusChatInput
  } = useChatHandler()

  // Now it's safe to use the handleFocusChatInput function
  useHotkey("l", () => handleFocusChatInput())

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
  const { filesToAccept, handleSelectDeviceFile } = useSelectFileHandler()
  const {
    setNewMessageContentToNextUserMessage,
    setNewMessageContentToPreviousUserMessage
  } = useChatHistoryHandler()

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
        handleSendMessage(userInput, chatMessages, false)
      }
      // ... (rest of the keydown logic)
    },
    [
      isTyping,
      isPromptPickerOpen,
      isFilePickerOpen,
      isToolPickerOpen,
      isAssistantPickerOpen,
      userInput,
      chatMessages,
      handleSendMessage,
      setIsPromptPickerOpen
      // ... (rest of dependencies)
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
            toast.error(
              `Images are not supported for this model. Use models like Rhyno V5 instead.`
            )
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
          placeholder={t(`Ask anything. Type @  /  #  !`)}
          onValueChange={handleInputChange}
          value={userInput}
          minRows={1}
          maxRows={18}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsTyping(true)}
          onCompositionEnd={() => setIsTyping(false)}
        />

        <div className="absolute bottom-2.5 right-3 cursor-pointer">
          {isGenerating ? (
            <IconPlayerStopFilled
              className="hover:bg-background animate-pulse rounded bg-transparent p-1"
              onClick={handleStopMessage}
              size={30}
            />
          ) : (
            <IconSend
              className={cn(
                "bg-primary text-secondary rounded p-1",
                !userInput && "cursor-not-allowed opacity-50"
              )}
              onClick={() => {
                if (!userInput) return
                handleSendMessage(userInput, chatMessages, false)
              }}
              size={28}
            />
          )}
        </div>
      </div>
    </>
  )
}
