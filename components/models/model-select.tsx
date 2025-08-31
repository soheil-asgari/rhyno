import { FC } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"

interface ModelSelectProps {
  selectedModelId: string
  onSelectModel: (modelId: string) => void
}

// اسم‌ها + توضیح‌ها + ایموجی
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "💨 Rhyno V1",
  "gpt-4": "🧠 Rhyno V2",
  "gpt-4-turbo-preview": "⚡ Rhyno V3 Turbo",
  "gpt-4o": "🚀 Rhyno V4 Ultra",
  "gpt-4o-mini": "⚡ Rhyno V4 Mini",
  "gpt-5": "🌌 Rhyno V5 Ultra",
  "gpt-5-mini": "✨ Rhyno V5 Mini",
  "gpt-4o-realtime-preview-2025-06-03": "🎙️ Rhyno Live V1",
  "gpt-4o-mini-realtime-preview-2024-12-17": "🎧 Rhyno Live Mini",
  "dall-e-3": "🎨 Rhyno Image V1"
}

const MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-3.5-turbo": "💨 سریع و اقتصادی؛ مناسب برای چت‌های روزمره",
  "gpt-4": "🧠 دقت بالا؛ مناسب متن‌های تحلیلی و طولانی",
  "gpt-4-turbo-preview": "⚡ نسخه سریع‌تر GPT-4 با هزینه کمتر",
  "gpt-4o": "🚀 پرچم‌دار چندحالته (متن، تصویر، صدا)",
  "gpt-4o-mini": "⚡ سبک و سریع؛ مناسب کارای روتین",
  "gpt-5": "🌌 نسل جدید؛ قدرت بالا برای پروژه‌های پیچیده",
  "gpt-5-mini": "✨ نسخه سبک V5؛ سریع و بهینه برای مکالمه",
  "gpt-4o-realtime-preview-2025-06-03": "🎙️ مکالمه زنده با پشتیبانی صوت و متن",
  "gpt-4o-mini-realtime-preview-2024-12-17":
    "🎧 نسخه ریل‌تایم کوچک؛ مناسب چت فوری",
  "dall-e-3": "🎨 تولید تصویر خلاقانه از متن."
}

const MODEL_IDS = Object.keys(MODEL_DISPLAY_NAMES)

export const ModelSelect: FC<ModelSelectProps> = ({
  selectedModelId,
  onSelectModel
}) => {
  return (
    <div className="w-full">
      <label className="mb-1 block text-sm font-medium">Select Model</label>
      <Select onValueChange={onSelectModel} defaultValue={selectedModelId}>
        <SelectTrigger className="font-vazir w-full">
          <SelectValue placeholder=" font-vazir Select Model" />
        </SelectTrigger>
        <SelectContent>
          {MODEL_IDS.map(id => (
            <SelectItem key={id} value={id}>
              <div className="flex flex-col">
                <span className=" font-vazir font-medium">
                  {MODEL_DISPLAY_NAMES[id]}
                </span>
                <span className="font-vazir text-muted-foreground text-xs">
                  {MODEL_DESCRIPTIONS[id]}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
