import { ChatbotUIContext } from "@/context/context"
import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import useHotkey from "@/lib/hooks/use-hotkey"
import { LLMID, ModelProvider } from "@/types"
import { IconAdjustmentsHorizontal } from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef } from "react"
import { Button } from "../ui/button"
import { ChatSettingsForm } from "../ui/chat-settings-form"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"

interface ChatSettingsProps {}

// نمایش نام مدل‌ها
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "💨 Rhyno V1",
  "gpt-3.5-turbo-16k": "💨 Rhyno V1 Pro",
  "gpt-4": "🧠 Rhyno V4",
  "gpt-4-turbo": "⚡ Rhyno V4 Turbo",
  "gpt-4-turbo-preview": "⚡ Rhyno V4 Preview",
  "gpt-4o": "🚀 Rhyno V4 Ultra",
  "gpt-4o-mini": "⚡ Rhyno V4 Mini",
  "computer-use-preview": "🖥️ Rhyno Auto", // ✅ اضافه شد
  "gpt-5": "🌌 Rhyno V5 Ultra",
  "gpt-5-mini": "✨ Rhyno V5 Mini",
  "gpt-5-nano": "🔹 Rhyno V5 Nano",
  "gpt-realtime": "🎙️ Rhyno Live V1",
  "gpt-realtime-mini": "🎧 Rhyno Live Mini",
  "dall-e-3": "🎨 Rhyno Image V1",
  "google/gemini-3-pro-image-preview": "🎨 Rhyno Image V2",
  "gpt-5-codex": "💻 Rhyno Code V1"
}

// پرامپت‌های پیش‌فرض
const MODEL_PROMPTS: Record<string, string> = {
  "gpt-3.5-turbo":
    "You are a friendly, helpful AI assistant. Your name is Rhyno v1",
  "gpt-3.5-turbo-16k":
    "You are a friendly AI with extended memory. Your name is Rhyno v1 Pro",
  "gpt-4": "You are a highly intelligent AI assistant. Your name is Rhyno v2",
  "gpt-4-turbo":
    "You are a faster, cost-efficient AI assistant. Your name is Rhyno V4 Turbo",
  "gpt-4-turbo-preview":
    "You are an experimental fast AI assistant. Your name is Rhyno V4 Preview",
  "gpt-4o":
    "You are a powerful AI assistant with extended reasoning. Your name is Rhyno v4.1",
  "gpt-4o-mini":
    "You are a mini version of AI assistant. Your name is Rhyno v4 mini",

  "computer-use-preview":
    "You are Rhyno Auto, an AI that can interact with computer interfaces and automate tasks",
  "gpt-5": "You are GPT-5 AI assistant. Your name is Rhyno v5",
  "gpt-5-mini": "You are GPT-5 mini AI assistant. Your name is Rhyno v5 mini",
  "gpt-5-nano": "You are GPT-5 nano AI assistant. Your name is Rhyno v5 nano",
  "gpt-realtime":
    "You are Rhyno Live, respond in real-time Persian voice and text",
  "gpt-realtime-mini":
    "You are Rhyno Live Mini, real-time Persian chat assistant",
  "gpt-5-codex":
    "You are Rhyno Code V1, expert in programming and code assistance"
}

export const ChatSettings: FC<ChatSettingsProps> = () => {
  const {
    chatSettings,
    setChatSettings,
    models,
    availableHostedModels,
    availableLocalModels,
    availableOpenRouterModels
  } = useContext(ChatbotUIContext)

  const buttonRef = useRef<HTMLButtonElement>(null)

  useHotkey("i", () => buttonRef.current?.click())

  // حالت اولیه پرامپت را بر اساس مدل انتخاب شده تنظیم می‌کند
  useEffect(() => {
    if (!chatSettings) return

    const selectedModel = chatSettings.model
    // console.log(
    //   `Setting new prompt for model ${selectedModel}:`,
    //   MODEL_PROMPTS[selectedModel]
    // )
    if (selectedModel.includes("realtime")) {
      console.log(`Realtime model selected ${selectedModel}, skipping prompt.`)
      setChatSettings(prevSettings => ({
        ...prevSettings,
        prompt: "" // خالی بمونه → backend خودش instructions ست می‌کنه
      }))
      return
    }
    // console.log(
    //   `Setting new prompt for model ${selectedModel}:`,
    //   MODEL_PROMPTS[selectedModel]
    // )
    // اگر پرامپت فعلی خالی است، پرامپت پیش‌فرض را اعمال می‌کند
    if (
      !chatSettings.prompt ||
      MODEL_PROMPTS[selectedModel] !== chatSettings.prompt
    ) {
      setChatSettings(prevSettings => ({
        ...prevSettings,
        prompt: MODEL_PROMPTS[selectedModel] || "" // یک پرامپت پیش‌فرض را اعمال کنید
      }))
    }
  }, [chatSettings?.model, chatSettings?.prompt, setChatSettings])

  // محدود کردن مقادیر temperature و contextLength
  useEffect(() => {
    if (!chatSettings) return

    const selectedModel = chatSettings.model

    const updatedTemperature = [
      "gpt-4-vision-preview",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-5",
      "gpt-5-mini"
    ].includes(selectedModel)
      ? 1
      : (chatSettings.temperature ?? 0.7)

    const newSettings = {
      ...chatSettings,
      temperature: Math.min(
        updatedTemperature,
        CHAT_SETTING_LIMITS[selectedModel]?.MAX_TEMPERATURE ?? 1
      ),
      contextLength: Math.min(
        chatSettings.contextLength,
        CHAT_SETTING_LIMITS[selectedModel]?.MAX_CONTEXT_LENGTH ?? 4096
      )
    }

    setChatSettings(newSettings)
  }, [chatSettings?.model])

  if (!chatSettings) return null

  const allModels = [
    ...models.map(model => ({
      modelId: model.model_id as LLMID,
      modelName: model.name,
      provider: "custom" as ModelProvider,
      hostedId: model.id,
      platformLink: "",
      imageInput: true
    })),
    ...availableHostedModels,
    ...availableLocalModels,
    ...availableOpenRouterModels
  ]

  const fullModel = allModels.find(llm => llm.modelId === chatSettings.model)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          className="flex items-center space-x-2"
          variant="ghost"
          size="default"
        >
          <div className="max-w-[120px] truncate text-lg sm:max-w-[300px] lg:max-w-[500px]">
            {MODEL_DISPLAY_NAMES[chatSettings.model] ||
              fullModel?.modelName ||
              chatSettings.model}
          </div>
          <IconAdjustmentsHorizontal size={28} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-background border-input relative flex max-h-[calc(100vh-60px)] w-[300px] flex-col space-y-4 overflow-auto rounded-lg border-2 p-6 sm:w-[350px] md:w-[400px] lg:w-[500px] dark:border-none"
        align="end"
      >
        <ChatSettingsForm
          chatSettings={chatSettings}
          onChangeChatSettings={setChatSettings}
        />
      </PopoverContent>
    </Popover>
  )
}
