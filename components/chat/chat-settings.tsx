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

// پرامپت‌های پیش‌فرض
const MODEL_PROMPTS: Record<string, string> = {
  "gpt-3.5-turbo":
    "You are a friendly, helpful AI assistant. yor name is Rhyno v1",
  "gpt-4": "You are a highly intelligent AI assistant.yor name is Rhyno v2",
  "gpt-4o":
    "You are a powerful AI assistant with extended reasoning.yor name is Rhyno v4.1",
  "gpt-4o-mini":
    "You are a mini version of AI assistant.yor name is Rhyno v4 mini",
  "gpt-5": "You are GPT-5 AI assistant.yor name is Rhyno v5",
  "gpt-5-mini": "You are GPT-5 mini AI assistant.yor name is Rhyno v5 mini"
  // "dall-e-3": "You are Rhyno Image, generate high quality creative images.yor name is Rhyno image"
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
    console.log(
      `Setting new prompt for model ${selectedModel}:`,
      MODEL_PROMPTS[selectedModel]
    )
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
      : chatSettings.temperature ?? 0.7

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
