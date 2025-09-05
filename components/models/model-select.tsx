import { FC } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select"

interface ModelSelectProps {
  selectedModelId: string
  onSelectModel: (modelId: string) => void
}

// دسته‌بندی مدل‌ها با مدل‌های جدید
const MODEL_CATEGORIES: Record<
  string,
  { id: string; name: string; desc: string }[]
> = {
  "📝 متنی": [
    { id: "gpt-3.5-turbo", name: "💨 Rhyno V1", desc: "سریع و اقتصادی" },
    {
      id: "gpt-3.5-turbo-16k",
      name: "💨 Rhyno V1 Pro",
      desc: "حافظه طولانی تا 16K توکن"
    },
    { id: "gpt-4", name: "🧠 Rhyno V2", desc: "دقیق و تحلیلی" },
    {
      id: "gpt-4-turbo",
      name: "⚡ Rhyno V3 Turbo",
      desc: "نسخه سریع و کم‌هزینه"
    },
    {
      id: "gpt-4-turbo-preview",
      name: "⚡ Rhyno V3 Preview",
      desc: "نسخه پیش‌نمایش سریع"
    }
  ],
  "🚀 پیشرفته": [
    { id: "gpt-4o", name: "🚀 Rhyno V4 Ultra", desc: "چندحالته پرچم‌دار" },
    { id: "gpt-4o-mini", name: "⚡ Rhyno V4 Mini", desc: "سبک و سریع" },
    { id: "gpt-5", name: "🌌 Rhyno V5 Ultra", desc: "نسل جدید و قدرتمند" },
    { id: "gpt-5-mini", name: "✨ Rhyno V5 Mini", desc: "نسخه سبک V5" },
    {
      id: "gpt-5-nano",
      name: "🔹 Rhyno V5 Nano",
      desc: "کوچک‌ترین و اقتصادی‌ترین نسخه V5"
    } // 🔥 اضافه شد
  ],
  "🎧 Realtime / صوتی": [
    {
      id: "gpt-4o-realtime-preview-2025-06-03",
      name: "🎙️ Rhyno Live V1",
      desc: "مکالمه زنده با صدا و متن"
    },
    {
      id: "gpt-4o-mini-realtime-preview-2024-12-17",
      name: "🎧 Rhyno Live Mini",
      desc: "نسخه ریل‌تایم کوچک"
    }
  ],
  "🎨 تصویری": [
    { id: "dall-e-3", name: "🎨 Rhyno Image V1", desc: "تولید تصویر از متن" }
  ],
  "💻 برنامه‌نویسی / کدنویسی": [
    {
      id: "gpt-4.1",
      name: "💻 Rhyno Code V1",
      desc: "کمک به کدنویسی و برنامه‌نویسی"
    }
    // { id: "gpt-5-code", name: "💻 Rhyno Code V2", desc: "نسل جدید برای برنامه‌نویسی پیشرفته" }
  ]
}

export const ModelSelect: FC<ModelSelectProps> = ({
  selectedModelId,
  onSelectModel
}) => {
  return (
    <div className="w-full">
      <label className="mb-1 block text-sm font-medium">انتخاب مدل</label>
      <Select onValueChange={onSelectModel} defaultValue={selectedModelId}>
        <SelectTrigger className="font-vazir w-full">
          <SelectValue placeholder="یک مدل انتخاب کنید" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(MODEL_CATEGORIES).map(([category, models], idx) => (
            <SelectGroup key={category}>
              <SelectLabel className="font-vazir rounded bg-gray-50 px-2 py-1 text-xs font-bold text-gray-500">
                {category}
              </SelectLabel>
              {models.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <span className="font-vazir font-medium">{model.name}</span>
                    <span className="font-vazir text-muted-foreground text-xs">
                      {model.desc}
                    </span>
                  </div>
                </SelectItem>
              ))}
              {idx < Object.keys(MODEL_CATEGORIES).length - 1 && (
                <div className="my-1 h-px bg-gray-200" />
              )}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
