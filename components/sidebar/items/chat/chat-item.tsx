import { ModelIcon } from "@/components/models/model-icon"
import { WithTooltip } from "@/components/ui/with-tooltip"
import { ChatbotUIContext } from "@/context/context"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { cn } from "@/lib/utils"
import { Tables } from "@/supabase/types"
import { LLM } from "@/types"
import { IconRobotFace } from "@tabler/icons-react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { FC, useContext, useRef } from "react"
import { DeleteChat } from "./delete-chat"
import { UpdateChat } from "./update-chat"

interface ChatItemProps {
  chat: Tables<"chats">
}
// نمایش نام مدل‌ها
// نمایش نام مدل‌ها
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "💨 Rhyno V1",
  "gpt-3.5-turbo-16k": "💨 Rhyno V1 Pro",
  "gpt-4": "🧠 Rhyno V2",
  "gpt-4-turbo": "⚡ Rhyno V3 Turbo",
  "gpt-4-turbo-preview": "⚡ Rhyno V3 Preview",
  "gpt-4o": "🚀 Rhyno V4 Ultra",
  "gpt-4o-mini": "⚡ Rhyno V4 Mini",
  "gpt-4o-mini-tts": "🎤 Rhyno TTS", // ✅ اضافه شد
  "gpt-4o-transcribe": "🎙️ Rhyno Transcribe", // ✅ اضافه شد
  "computer-use-preview": "🖥️ Rhyno Auto", // ✅ اضافه شد
  "gpt-5": "🌌 Rhyno V5 Ultra",
  "gpt-5-mini": "✨ Rhyno V5 Mini",
  "gpt-5-nano": "🔹 Rhyno V5 Nano",
  "gpt-4o-realtime-preview-2025-06-03": "🎙️ Rhyno Live V1",
  "gpt-4o-mini-realtime-preview-2024-12-17": "🎧 Rhyno Live Mini",
  "dall-e-3": "🎨 Rhyno Image V1",
  "gpt-4.1": "💻 Rhyno Code V1"
}

// پرامپت‌های پیش‌فرض
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
  //   "You are Rhyno TTS, an AI that converts text to natural speech", // ✅ اضافه شد
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

export const ChatItem: FC<ChatItemProps> = ({ chat }) => {
  const {
    selectedWorkspace,
    selectedChat,
    availableLocalModels,
    assistantImages,
    availableOpenRouterModels
  } = useContext(ChatbotUIContext)

  const router = useRouter()
  const params = useParams()
  const isActive = params.chatid === chat.id || selectedChat?.id === chat.id

  const itemRef = useRef<HTMLDivElement>(null)

  const handleClick = () => {
    console.log("✅ مرحله ۱: روی چت کلیک شد. ID:", chat.id)
    console.log(
      `[ChatItem] روی چت کلیک شد. در حال تلاش برای ناوبری به چت با ID: ${chat.id}`
    )
    console.log("[ChatItem] وضعیت فعلی selectedWorkspace:", selectedWorkspace)
    if (!selectedWorkspace) return
    console.error(
      "[ChatItem] خطا: selectedWorkspace تعریف نشده است! ناوبری لغو شد."
    )
    console.log(
      `[ChatItem] ناوبری به: /${selectedWorkspace.id}/chat/${chat.id}`
    )
    return router.push(`/${selectedWorkspace.id}/chat/${chat.id}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.stopPropagation()
      itemRef.current?.click()
    }
  }

  const MODEL_DATA = [
    ...LLM_LIST,
    ...availableLocalModels,
    ...availableOpenRouterModels
  ].find(llm => llm.modelId === chat.model) as LLM

  const assistantImage = assistantImages.find(
    image => image.assistantId === chat.assistant_id
  )?.base64
  const modelDisplayName =
    MODEL_DISPLAY_NAMES[MODEL_DATA?.modelId] || MODEL_DATA?.modelName
  return (
    <div
      ref={itemRef}
      className={cn(
        "hover:bg-accent focus:bg-accent group flex w-full cursor-pointer items-center rounded p-2 hover:opacity-50 focus:outline-none",
        isActive && "bg-accent"
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      {chat.assistant_id ? (
        assistantImage ? (
          <Image
            style={{ width: "30px", height: "30px" }}
            className="rounded"
            src={assistantImage}
            alt="Assistant image"
            width={30}
            height={30}
          />
        ) : (
          <IconRobotFace
            className="bg-primary text-secondary border-primary rounded border-DEFAULT p-1"
            size={30}
          />
        )
      ) : (
        <WithTooltip
          delayDuration={200}
          display={<div>{modelDisplayName}</div>}
          trigger={
            <ModelIcon provider={MODEL_DATA?.provider} height={30} width={30} />
          }
        />
      )}

      <div className="ml-3 flex-1 truncate text-sm font-semibold">
        {chat.name}
      </div>

      <div
        onClick={e => {
          e.stopPropagation()
          e.preventDefault()
        }}
        className={`ml-2 flex space-x-2 ${!isActive && "w-11 opacity-0 group-hover:opacity-100"}`}
      >
        <UpdateChat chat={chat} />

        <DeleteChat chat={chat} />
      </div>
    </div>
  )
}
