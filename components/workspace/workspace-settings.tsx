import { ChatbotUIContext } from "@/context/context"
import { WORKSPACE_INSTRUCTIONS_MAX } from "@/db/limits"
import {
  getWorkspaceImageFromStorage,
  uploadWorkspaceImage
} from "@/db/storage/workspace-images"
import { updateWorkspace } from "@/db/workspaces"
import { convertBlobToBase64 } from "@/lib/blob-to-b64"
import { LLMID } from "@/types"
import { IconHome, IconSettings } from "@tabler/icons-react"
import { FC, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { ChatSettingsForm } from "../ui/chat-settings-form"
import ImagePicker from "../ui/image-picker"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { LimitDisplay } from "../ui/limit-display"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "../ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { TextareaAutosize } from "../ui/textarea-autosize"
import { WithTooltip } from "../ui/with-tooltip"
import { DeleteWorkspace } from "./delete-workspace"

type ChatSettingsState = {
  model: LLMID
  prompt: string
  temperature: number
  contextLength: number
  includeProfileContext: boolean
  includeWorkspaceInstructions: boolean
  embeddingsProvider: "openai" | "local"
}

interface WorkspaceSettingsProps {}

// const MODEL_PROMPTS: Record<string, string> = {
//   "gpt-3.5-turbo": "You are Rhyno v1, optimized for speed and efficiency.",
//   "gpt-4": "You are Rhyno v2, provide detailed and accurate answers.",
//   "gpt-4-turbo-preview":
//     "You are Rhyno v3, optimized for reasoning and analysis.",
//   "gpt-5": "You are Rhyno v5, the most advanced model with deep reasoning.",
//   "gpt-5-mini": "You are Rhyno v5 mini, lightweight and fast responses.",
//   "gpt-4o": "You are Rhyno v4.1, multimodal and balanced in detail.",
//   "gpt-4o-mini": "You are Rhyno v4 mini, optimized for quick interactions.",
//   // "dall-e-3": "You are Rhyno Image, generate high quality creative images.",
//   "gpt-4o-realtime-preview-2025-06-03": "Rhyno l-1",
//   "gpt-4o-mini-realtime-preview-2024-12-17": "Rhyno l-mini"
// }

// نمایش نام مدل‌ها
// نمایش نام مدل‌ها
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "💨 Rhyno V1",
  "gpt-3.5-turbo-16k": "💨 Rhyno V1 Pro",
  "gpt-4": "🧠 Rhyno V4",
  "gpt-4-turbo": "⚡ Rhyno V4 Turbo",
  "gpt-4-turbo-preview": "⚡ Rhyno V4 Preview",
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
  "google/gemini-2.5-flash-image": "🎨 Rhyno Image V2",
  "gpt-5-codex": "💻 Rhyno Code V1",
  "google/gemini-2.5-pro": "🖥️ Rhyno Pro"
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
  "gpt-5-codex":
    "You are Rhyno Code V1, expert in programming and code assistance",
  "google/gemini-2.5-pro": ""
}

export const WorkspaceSettings: FC<WorkspaceSettingsProps> = () => {
  const {
    profile,
    selectedWorkspace,
    setSelectedWorkspace,
    setWorkspaces,
    setChatSettings,
    workspaceImages,
    setWorkspaceImages
  } = useContext(ChatbotUIContext)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const [name, setName] = useState(selectedWorkspace?.name || "")
  const [imageLink, setImageLink] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [description, setDescription] = useState(
    selectedWorkspace?.description || ""
  )
  const [instructions, setInstructions] = useState(
    selectedWorkspace?.instructions || ""
  )

  const [defaultChatSettings, setDefaultChatSettings] =
    useState<ChatSettingsState>({
      model: (selectedWorkspace?.default_model ?? "gpt-4") as LLMID,
      prompt:
        selectedWorkspace?.default_prompt ??
        MODEL_PROMPTS[selectedWorkspace?.default_model ?? "gpt-4"] ??
        "",
      temperature: selectedWorkspace?.default_temperature ?? 0.7,
      contextLength: selectedWorkspace?.default_context_length ?? 4096,
      includeProfileContext: selectedWorkspace?.include_profile_context ?? true,
      includeWorkspaceInstructions:
        selectedWorkspace?.include_workspace_instructions ?? true,
      embeddingsProvider: (selectedWorkspace?.embeddings_provider ??
        "openai") as "openai" | "local"
    })

  // 👇 تایپ prev به شکل دقیق
  const handleModelChange = (model: LLMID) => {
    setDefaultChatSettings((prev: ChatSettingsState) => ({
      ...prev,
      model,
      prompt: MODEL_PROMPTS[model] || prev.prompt
    }))
  }

  useEffect(() => {
    const workspaceImage =
      workspaceImages.find(
        image => image.path === selectedWorkspace?.image_path
      )?.base64 || ""
    setImageLink(workspaceImage)
  }, [workspaceImages, selectedWorkspace?.image_path])

  const handleSave = async () => {
    if (!selectedWorkspace) return

    let imagePath = ""

    if (selectedImage) {
      imagePath = await uploadWorkspaceImage(selectedWorkspace, selectedImage)
      const url = (await getWorkspaceImageFromStorage(imagePath)) || ""
      if (url) {
        const blob = await (await fetch(url)).blob()
        const base64 = await convertBlobToBase64(blob)
        setWorkspaceImages(prev => [
          ...prev,
          {
            workspaceId: selectedWorkspace.id,
            path: imagePath,
            base64,
            url
          }
        ])
      }
    }

    const updatedPrompt =
      MODEL_PROMPTS[defaultChatSettings.model] || defaultChatSettings.prompt

    const updatedWorkspace = await updateWorkspace(selectedWorkspace.id, {
      ...selectedWorkspace,
      name,
      description,
      image_path: imagePath,
      instructions,
      default_model: defaultChatSettings.model,
      default_prompt: updatedPrompt, // ← حتماً پرامپت صحیح مدل را ارسال کنید
      default_temperature: defaultChatSettings.temperature,
      default_context_length: defaultChatSettings.contextLength,
      embeddings_provider: defaultChatSettings.embeddingsProvider,
      include_profile_context: defaultChatSettings.includeProfileContext,
      include_workspace_instructions:
        defaultChatSettings.includeWorkspaceInstructions
    })

    setChatSettings({ ...defaultChatSettings })

    setIsOpen(false)
    setSelectedWorkspace(updatedWorkspace)
    setWorkspaces(workspaces =>
      workspaces.map(w =>
        w.id === selectedWorkspace.id ? updatedWorkspace : w
      )
    )

    toast.success("Workspace updated!")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) buttonRef.current?.click()
  }

  if (!selectedWorkspace || !profile) return null

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <WithTooltip
          display={<div>Workspace Settings</div>}
          trigger={
            <IconSettings
              className="ml-3 cursor-pointer pr-[5px] hover:opacity-50"
              size={32}
              onClick={() => setIsOpen(true)}
            />
          }
        />
      </SheetTrigger>

      <SheetContent
        className="flex flex-col justify-between"
        side="left"
        onKeyDown={handleKeyDown}
      >
        <div className="grow overflow-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              Workspace Settings
              {selectedWorkspace?.is_home && <IconHome />}
            </SheetTitle>

            {selectedWorkspace?.is_home && (
              <div className="text-sm font-light">
                This is your home workspace for personal use.
              </div>
            )}
          </SheetHeader>

          <Tabs defaultValue="main">
            <TabsList className="mt-4 grid w-full grid-cols-2">
              <TabsTrigger value="main">Main</TabsTrigger>
              <TabsTrigger value="defaults">Defaults</TabsTrigger>
            </TabsList>

            <TabsContent className="mt-4 space-y-4" value="main">
              <div className="space-y-1">
                <Label>Workspace Name</Label>
                <Input
                  placeholder="Name..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label>Workspace Image</Label>
                <ImagePicker
                  src={imageLink}
                  image={selectedImage}
                  onSrcChange={setImageLink}
                  onImageChange={setSelectedImage}
                  width={50}
                  height={50}
                />
              </div>

              <div className="space-y-1">
                <Label>
                  How would you like the AI to respond in this workspace?
                </Label>
                <TextareaAutosize
                  placeholder="Instructions... (optional)"
                  value={instructions}
                  onValueChange={setInstructions}
                  minRows={5}
                  maxRows={10}
                  maxLength={1500}
                />
                <LimitDisplay
                  used={instructions.length}
                  limit={WORKSPACE_INSTRUCTIONS_MAX}
                />
              </div>
            </TabsContent>

            <TabsContent className="mt-5" value="defaults">
              <div className="mb-4 text-sm">
                These are the settings your workspace begins with when selected.
              </div>

              <ChatSettingsForm
                chatSettings={defaultChatSettings}
                onChangeChatSettings={(newSettings: ChatSettingsState) => {
                  if (newSettings.model !== defaultChatSettings.model) {
                    handleModelChange(newSettings.model)
                  } else {
                    setDefaultChatSettings(newSettings)
                  }
                }}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-6 flex justify-between">
          <div>
            {!selectedWorkspace.is_home && (
              <DeleteWorkspace
                workspace={selectedWorkspace}
                onDelete={() => setIsOpen(false)}
              />
            )}
          </div>

          <div className="space-x-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button ref={buttonRef} onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
