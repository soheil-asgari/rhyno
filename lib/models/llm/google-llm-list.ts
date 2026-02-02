import { LLM } from "@/types"

const GOOGLE_PLATORM_LINK = "https://ai.google.dev/"
// ✨ لینک پلتفرم OpenRouter را اضافه می‌کنیم
const OPENROUTER_PLATFORM_LINK = "https://openrouter.ai/models/"

// Google Models (UPDATED 12/22/23) -----------------------------

// Gemini 1.5 Flash
const GEMINI_1_5_FLASH: LLM = {
  modelId: "gemini-1.5-flash",
  modelName: "Gemini 1.5 Flash",
  provider: "google",
  hostedId: "gemini-1.5-flash",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

// Gemini 1.5 Pro (UPDATED 05/28/24)
const GEMINI_1_5_PRO: LLM = {
  modelId: "gemini-1.5-pro-latest",
  modelName: "Gemini 1.5 Pro",
  provider: "google",
  hostedId: "gemini-1.5-pro-latest",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

// Gemini Pro (UPDATED 12/22/23)
const GEMINI_PRO: LLM = {
  modelId: "gemini-pro",
  modelName: "Gemini Pro",
  provider: "google",
  hostedId: "gemini-pro",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: false // این مدل از تصویر پشتیبانی نمی‌کند
}

// Gemini Pro Vision (UPDATED 12/22/23)
const GEMINI_PRO_VISION: LLM = {
  modelId: "gemini-pro-vision",
  modelName: "Gemini Pro Vision",
  provider: "google",
  hostedId: "gemini-pro-vision",
  platformLink: GOOGLE_PLATORM_LINK,
  imageInput: true
}

// ✨ مدل جدید شما در اینجا اضافه می‌شود
const GEMINI_2_5_FLASH_PREVIEW: LLM = {
  // شناسه دقیق مدل که در کل برنامه استفاده می‌شود
  modelId: "google/gemini-3-pro-image-preview",
  // نامی که به کاربر نمایش داده می‌شود
  modelName: "Gemini 2.5 Flash Preview",
  // از آنجایی که از طریق OpenRouter فراخوانی می‌شود، provider را openrouter می‌گذاریم
  provider: "openrouter",
  // شناسه میزبانی شده
  hostedId: "google/gemini-3-pro-image-preview",
  // لینک به صفحه مدل برای اطلاعات بیشتر
  platformLink: OPENROUTER_PLATFORM_LINK + "google/gemini-3-pro-image-preview",
  // ✨ مهم‌ترین بخش: قابلیت پردازش تصویر را فعال می‌کند
  imageInput: true
}

export const GOOGLE_LLM_LIST: LLM[] = [
  GEMINI_PRO,
  GEMINI_PRO_VISION,
  GEMINI_1_5_PRO,
  GEMINI_1_5_FLASH,
  // ✨ مدل جدید به لیست اضافه شد
  GEMINI_2_5_FLASH_PREVIEW
]
