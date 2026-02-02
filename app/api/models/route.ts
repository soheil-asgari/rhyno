// app/api/models/route.ts
import { NextResponse } from "next/server"
// 👇 ۱. ایمپورت کردن لیست اصلی پرامپت‌ها
import { MODEL_PROMPTS } from "@/lib/build-prompt"

// لیست نام‌های زیبا (بدون تغییر)
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "💨 Rhyno V1",
  "gpt-3.5-turbo-16k": "💨 Rhyno V1 Pro",
  "gpt-4": "🧠 Rhyno V4",
  "gpt-4-turbo": "⚡ Rhyno V4 Turbo",
  "gpt-4-turbo-preview": "⚡ Rhyno V4 Preview",
  "gpt-4o": "🚀 Rhyno V4 Ultra",
  "gpt-4o-mini": "⚡ Rhyno V4 Mini",
  "gpt-5": "🌌 Rhyno V5 Ultra",
  "gpt-5-mini": "✨ Rhyno V5 Mini",
  "gpt-5-nano": "🔹 Rhyno V5 Nano",
  "gpt-realtime": "🎙️ Rhyno Live V1",
  "gpt-realtime-mini": "🎧 Rhyno Live Mini",
  "dall-e-3": "🎨 Rhyno Image V1",
  "google/gemini-3-pro-image-preview": "🎨 Rhyno Image V2",
  "gpt-5-codex": "💻 Rhyno Code V1"
}

export async function GET(request: Request) {
  try {
    // 👇 ۲. خواندن لیست ID مدل‌ها از MODEL_PROMPTS
    const modelIds = Object.keys(MODEL_PROMPTS)

    // ۳. تبدیل لیست به فرمت { label, value }
    const formattedModels = modelIds.map(modelId => ({
      // 👇 ۴. پیدا کردن نام زیبا از DISPLAY_NAMES
      // اگر نام زیبا وجود نداشت، از خود ID مدل به عنوان Lable استفاده کن
      label: MODEL_DISPLAY_NAMES[modelId] || modelId,

      value: modelId // شناسه فنی
    }))

    // ۵. ارسال لیست به عنوان JSON
    return NextResponse.json(formattedModels)
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
