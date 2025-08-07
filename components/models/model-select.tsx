import { FC } from "react"

interface ModelSelectProps {
  selectedModelId: string
  onSelectModel: (modelId: string) => void
}

// فقط شناسه‌های مدل‌ها اینجاست
const MODEL_IDS = [
  "gpt-3.5-turbo",
  "gpt-4",
  "mixtral-8x7b",
  "llama3"
]

// اسامی نمایشی دلخواه شما برای هر مدل
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "چت سریع GPT 3.5 🚀",
  "gpt-4": "Rhyno 🎯",
  "mixtral-8x7b": "Mixtral هوش ترکیبی 🧠",
  "llama3": "LLaMA 3 متن‌باز 🦙"
}

export const ModelSelect: FC<ModelSelectProps> = ({
  selectedModelId,
  onSelectModel
}) => {
  return (
    <div className="w-full">
      <label htmlFor="model-select" className="text-sm font-medium mb-1 block">
        Select Model
      </label>
      <select
        id="model-select"
        className="w-full border rounded px-3 py-2 bg-background text-foreground"
        value={selectedModelId}
        onChange={(e) => onSelectModel(e.target.value)}
      >
        {MODEL_IDS.map((id) => (
          <option key={id} value={id}>
            {MODEL_DISPLAY_NAMES[id] || id}
          </option>
        ))}
      </select>
    </div>
  )
}
