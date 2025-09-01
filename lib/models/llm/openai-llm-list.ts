import { LLM } from "@/types"

const OPENAI_PLATFORM_LINK = "https://platform.openai.com/docs/overview"

// GPT-4o (Standard pricing from your table: input $2.50, output $10.00)
const GPT4o: LLM = {
  modelId: "gpt-4o",
  modelName: "GPT-4o",
  provider: "openai",
  hostedId: "gpt-4o",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 2.5,
    outputCost: 10.0
  }
}

// GPT-4 Turbo (mapped to legacy/standard entry gpt-4-turbo-2024-04-09 / similar): input $10, output $30
const GPT4Turbo: LLM = {
  modelId: "gpt-4-turbo-preview",
  modelName: "GPT-4 Turbo",
  provider: "openai",
  hostedId: "gpt-4-turbo-preview",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 10.0,
    outputCost: 30.0
  }
}

// GPT-5 (Standard tier in your table: input $1.25, output $10.00)
const GPT5: LLM = {
  modelId: "gpt-5",
  modelName: "gpt-5",
  provider: "openai",
  hostedId: "gpt-5",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 1.25,
    outputCost: 10.0
  }
}

const DALL_E_3: LLM = {
  modelId: "dall-e-3",
  modelName: "DALL-E 3",
  provider: "openai",
  hostedId: "dall-e-3",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "image",
    // table: DALL·E 3 Standard $0.04 per image (1024x1024 listed)
    inputCost: 0.04
  }
}

// GPT-5 Mini (Standard: input $0.25, output $2.00)
const GPT5Mini: LLM = {
  modelId: "gpt-5-mini",
  modelName: "gpt-5-mini",
  provider: "openai",
  hostedId: "gpt-5-mini",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.25,
    outputCost: 2.0
  }
}

// GPT-4 Vision (kept aligned with GPT-4 standard; text-token style pricing shown previously: input $30, output $60)
const GPT4Vision: LLM = {
  modelId: "gpt-4-vision-preview",
  modelName: "GPT-4 Vision",
  provider: "openai",
  hostedId: "gpt-4-vision-preview",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 30.0,
    outputCost: 60.0
  }
}

// GPT-4 standard (matching table: input $30, output $60)
const GPT4: LLM = {
  modelId: "gpt-4",
  modelName: "GPT-4",
  provider: "openai",
  hostedId: "gpt-4",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 30.0,
    outputCost: 60.0
  }
}

// GPT-3.5 Turbo (Standard in table: input $0.50, output $1.50)
const GPT3_5Turbo: LLM = {
  modelId: "gpt-3.5-turbo",
  modelName: "GPT-3.5 Turbo",
  provider: "openai",
  hostedId: "gpt-3.5-turbo",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.5,
    outputCost: 1.5
  }
}

// GPT-4o Mini (Standard: input $0.15, output $0.60)
const GPT4oMini: LLM = {
  modelId: "gpt-4o-mini",
  modelName: "GPT-4o Mini",
  provider: "openai",
  hostedId: "gpt-4o-mini",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: true,
  pricing: {
    currency: "USD",
    unit: "1M tokens",
    inputCost: 0.15,
    outputCost: 0.6
  }
}

// GPT-4o Realtime (Standard realtime entry: input $5.00, output $20.00)
const GPT4oRealtime: LLM = {
  modelId: "gpt-4o-realtime-preview-2025-06-03",
  modelName: "GPT-4o Realtime",
  provider: "openai",
  hostedId: "gpt-4o-realtime-preview-2025-06-03",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens (approx, realtime session)",
    inputCost: 5.0,
    outputCost: 20.0
  }
}

// GPT-4o Mini Realtime (Standard: input $0.60, output $2.40)
const GPT4oMiniRealtime: LLM = {
  modelId: "gpt-4o-mini-realtime-preview-2024-12-17",
  modelName: "GPT-4o Mini Realtime",
  provider: "openai",
  hostedId: "gpt-4o-mini-realtime-preview-2024-12-17",
  platformLink: OPENAI_PLATFORM_LINK,
  imageInput: false,
  pricing: {
    currency: "USD",
    unit: "1M tokens (approx, realtime session)",
    inputCost: 0.6,
    outputCost: 2.4
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
  GPT4oRealtime,
  GPT4oMiniRealtime
]
