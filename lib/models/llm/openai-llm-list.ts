import { LLM } from "@/types"

const OPENAI_PLATORM_LINK = "https://platform.openai.com/docs/overview"

// OpenAI Models (UPDATED 1/25/24) -----------------------------
const GPT4o: LLM = {
  modelId: "gpt-4o",
  modelName: "GPT-4o",
  provider: "openai",
  hostedId: "gpt-4o",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 5,
    outputCost: 15
  }
}

// GPT-4 Turbo (UPDATED 1/25/24)
const GPT4Turbo: LLM = {
  modelId: "gpt-4-turbo-preview",
  modelName: "GPT-4 Turbo",
  provider: "openai",
  hostedId: "gpt-4-turbo-preview",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 10,
    outputCost: 30
  }
}

const GPT5: LLM = {
  modelId: "gpt-5",
  modelName: "GPT-5",
  provider: "openai",
  hostedId: "gpt-5",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 1.25,
    outputCost: 10.0
  }
}

const DALL_E_3: LLM = {
  modelId: "dall-e-3", // باید "dall-e-3" باشد
  modelName: "DALL-E 3", // نام نمایشی صحیح
  provider: "openai",
  hostedId: "dall-e-3", // شناسه صحیح
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: false, // این مدل تصویر نمی‌گیرد، بلکه می‌سازد
  pricing: {
    // قیمت‌گذاری DALL-E 3 (اختیاری)
    currency: "USD",
    unit: "image",
    inputCost: 0.04 // قیمت برای هر تصویر با کیفیت استاندارد
  }
}

const GPT5Mini: LLM = {
  modelId: "gpt-5-mini",
  modelName: "GPT-5 Mini",
  provider: "openai",
  hostedId: "gpt-5-mini",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 1.25, // هزینه ورودی
    outputCost: 10.0 // هزینه خروجی
  }
}

// GPT-4 Vision (UPDATED 12/18/23)
const GPT4Vision: LLM = {
  modelId: "gpt-4-vision-preview",
  modelName: "GPT-4 Vision",
  provider: "openai",
  hostedId: "gpt-4-vision-preview",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 10
  }
}

// GPT-4 (UPDATED 1/29/24)
const GPT4: LLM = {
  modelId: "gpt-4",
  modelName: "GPT-4",
  provider: "openai",
  hostedId: "gpt-4",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 30,
    outputCost: 60
  }
}

// GPT-3.5 Turbo (UPDATED 1/25/24)
const GPT3_5Turbo: LLM = {
  modelId: "gpt-3.5-turbo",
  modelName: "GPT-3.5 Turbo",
  provider: "openai",
  hostedId: "gpt-3.5-turbo",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.5,
    outputCost: 1.5
  }
}
const GPT4oMini: LLM = {
  modelId: "gpt-4o-mini",
  modelName: "GPT-4o Mini",
  provider: "openai",
  hostedId: "gpt-4o-mini",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.15, // هزینه ورودی
    outputCost: 0.6 // هزینه خروجی
  }
}

const GPT4oRealtime: LLM = {
  modelId: "gpt-4o-realtime-preview-2025-06-03",
  modelName: "GPT-4o Realtime",
  provider: "openai",
  hostedId: "gpt-4o-realtime-preview-2025-06-03",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: false, // ورودی این مدل صدا و متن هست، نه تصویر
  pricing: {
    currency: "USD",
    unit: "1M tokens (approx, realtime session)",
    inputCost: 0, // قیمت دقیق هنوز مشخص نیست
    outputCost: 0
  }
}

const GPT4oMiniRealtime: LLM = {
  modelId: "gpt-4o-mini-realtime-preview-2024-12-17",
  modelName: "GPT-4o Mini Realtime",
  provider: "openai",
  hostedId: "gpt-4o-mini-realtime-preview-2024-12-17",
  platformLink: OPENAI_PLATORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens (approx, realtime session)",
    inputCost: 0,
    outputCost: 0
  }
}

export const OPENAI_LLM_LIST: LLM[] = [
  GPT4o,
  GPT4Turbo,
  GPT4Vision,
  GPT4,
  GPT3_5Turbo,
  GPT5,
  GPT5Mini,
  GPT4oMini,
  DALL_E_3,
  GPT4oRealtime, // 👈 اضافه شد
  GPT4oMiniRealtime
]
