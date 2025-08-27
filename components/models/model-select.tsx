import { FC } from "react"

interface ModelSelectProps {
  selectedModelId: string
  onSelectModel: (modelId: string) => void
}

// اسامی نمایشی
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "Rhyno v1",
  "gpt-4": "Rhyno v2",
  "gpt-4-turbo-preview": "Rhyno v3",
  "gpt-5": "Rhyno v5",
  "gpt-5-mini": "Rhyno v5 mini",
  "gpt-4o": "Rhyno v4.1",
  "gpt-4o-mini": "Rhyno v4 mini",
  "dall-e-3": "Rhyno Image",
  "gpt-4o-realtime-preview-2025-06-03": "Rhyno l-1",
  "gpt-4o-mini-realtime-preview-2024-12-17": "Rhyno l-mini"
}
// شناسه‌ها
const MODEL_IDS = Object.keys(MODEL_DISPLAY_NAMES)

// لاگ اولیه لیست مدل‌ها
console.log("Available models:", MODEL_IDS)

export const ModelSelect: FC<ModelSelectProps> = ({
  selectedModelId,
  onSelectModel
}) => {
  return (
    <div className="w-full">
      <label htmlFor="model-select" className="mb-1 block text-sm font-medium">
        Select Model
      </label>
      <select
        id="model-select"
        className="bg-background text-foreground w-full rounded border px-3 py-2"
        value={selectedModelId}
        onChange={e => {
          const newModel = e.target.value
          console.log("Model selected:", newModel) // ← لاگ انتخاب
          onSelectModel(newModel)
        }}
      >
        {MODEL_IDS.map(id => (
          <option key={id} value={id}>
            {MODEL_DISPLAY_NAMES[id] || id}
          </option>
        ))}
      </select>
    </div>
  )
}
