// pricing.ts
export interface ModelPricing {
  id: string
  name: string
  توضیحات: string
  inputPricePer1MTokenUSD: number
  outputPricePer1MTokenUSD: number
  costExampleUSD: number
  finalCostUSD: number
  finalCostRial: number
}

const RIAL_RATE = 10300

// مثال مصرف: 1500 ورودی، 3000 خروجی
const INPUT_TOKENS = 2000
const OUTPUT_TOKENS = 4000
const PROFIT_MARGIN = 1.8

const calcCost = (inputPrice: number, outputPrice: number) => {
  const base =
    ((inputPrice * INPUT_TOKENS + outputPrice * OUTPUT_TOKENS) / 1_000_000) *
    1.5
  const final = base * PROFIT_MARGIN
  return { base, final }
}

export const models: ModelPricing[] = [
  // --- GPT-5 family ---
  {
    id: "gpt-5",
    name: "🌌 Rhyno V5 Ultra",
    توضیحات: "جدیدترین مدل پرچمدار برای کارهای سنگین و دقیق",
    inputPricePer1MTokenUSD: 3.25,
    outputPricePer1MTokenUSD: 40.0,
    ...(() => {
      const { base, final } = calcCost(1.25, 20.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-3.5-turbo-16k",
    name: "💨 Rhyno V1 Pro", // (یا هر نامی که دوست دارید)
    توضیحات: "مدل قوی و کارآمد برای کارهای متوسط و سریع",
    inputPricePer1MTokenUSD: 0.5, // قیمت واقعی (مثلاً 0.5 دلار)
    outputPricePer1MTokenUSD: 10.5, // قیمت واقعی (مثلاً 1.5 دلار)
    ...(() => {
      const { base, final } = calcCost(0.5, 10.5) // 👈 از همان قیمت‌ها استفاده کنید
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-3.5-turbo",
    name: "💨 Rhyno V1", // (یا هر نامی که دوست دارید)
    توضیحات: "مدل کارآمد برای کارهای متوسط ",
    inputPricePer1MTokenUSD: 0.5, // قیمت واقعی (مثلاً 0.5 دلار)
    outputPricePer1MTokenUSD: 8.5, // قیمت واقعی (مثلاً 1.5 دلار)
    ...(() => {
      const { base, final } = calcCost(0.5, 10.5) // 👈 از همان قیمت‌ها استفاده کنید
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4o-transcribe",
    name: "🎙️ Rhyno Transcribe",
    توضیحات: "جدیدترین مدل پرچمدار برای تبدیل صدا به متن",
    inputPricePer1MTokenUSD: 6.25,
    outputPricePer1MTokenUSD: 30.0,
    ...(() => {
      const { base, final } = calcCost(6.25, 30.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4-turbo-preview",
    name: "⚡ Rhyno V4 Preview",
    توضیحات: "قدرت و سرعت بی‌نظیر برای کارهای پیچیده",
    inputPricePer1MTokenUSD: 36.25,
    outputPricePer1MTokenUSD: 70.0,
    ...(() => {
      const { base, final } = calcCost(36.25, 70.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4-turbo",
    name: "⚡ Rhyno V4 Turbo",
    توضیحات: "مدل سریع و کارآمد برای کارهای سریع",
    inputPricePer1MTokenUSD: 20.25,
    outputPricePer1MTokenUSD: 60.0,
    ...(() => {
      const { base, final } = calcCost(30.25, 60.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4",
    name: "🧠 Rhyno V4",
    توضیحات: "قدرت بالای پردازش و کارایی عالی",
    inputPricePer1MTokenUSD: 90,
    outputPricePer1MTokenUSD: 200.0,
    ...(() => {
      const { base, final } = calcCost(90, 200.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-5-mini",
    name: "✨ Rhyno V5 Mini",
    توضیحات: "نسخه سبک‌تر V5 برای کارهای روزمره",
    inputPricePer1MTokenUSD: 4.5,
    outputPricePer1MTokenUSD: 30.5,
    ...(() => {
      const { base, final } = calcCost(2.5, 15.5)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-5-nano",
    name: "⚡ Rhyno V5 Nano",
    توضیحات: "کوچک‌ترین و سریع‌ترین نسخه V5",
    inputPricePer1MTokenUSD: 2.85,
    outputPricePer1MTokenUSD: 22.7,
    ...(() => {
      const { base, final } = calcCost(0.85, 11.7)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-5-chat-latest",
    name: "💬 Rhyno V5 Chat",
    توضیحات: "بهینه برای مکالمه و چت روزمره",
    inputPricePer1MTokenUSD: 1.25,
    outputPricePer1MTokenUSD: 16.0,
    ...(() => {
      const { base, final } = calcCost(1.25, 16.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },

  // --- gpt-5-codex family ---
  {
    id: "gpt-5-codex",
    name: "💻 Rhyno Code V1",
    توضیحات: "کمک به کدنویسی و برنامه‌نویسی",
    inputPricePer1MTokenUSD: 10.0,
    outputPricePer1MTokenUSD: 28.0,
    ...(() => {
      const { base, final } = calcCost(10.0, 28.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-5-codex-mini",
    name: "⚡ Rhyno V4.1 Mini",
    توضیحات: "نسخه سریع‌تر و ارزان‌تر V4.1",
    inputPricePer1MTokenUSD: 1.0,
    outputPricePer1MTokenUSD: 11.2,
    ...(() => {
      const { base, final } = calcCost(1.0, 11.2)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-5-codex-nano",
    name: "💨 Rhyno V4.1 Nano",
    توضیحات: "کم‌هزینه‌ترین نسخه V4.1",
    inputPricePer1MTokenUSD: 0.1,
    outputPricePer1MTokenUSD: 10.4,
    ...(() => {
      const { base, final } = calcCost(0.1, 10.4)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },

  // --- GPT-4 Omni family ---
  {
    id: "gpt-4o",
    name: "🚀 Rhyno V4",
    توضیحات: "مدل همه‌فن‌حریف با سرعت و دقت بالا",
    inputPricePer1MTokenUSD: 2.5,
    outputPricePer1MTokenUSD: 11.0,
    ...(() => {
      const { base, final } = calcCost(2.5, 11.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4o-mini",
    name: "⚡ Rhyno V4 Mini",
    توضیحات: "نسخه کوچک و سریع Omni",
    inputPricePer1MTokenUSD: 1.15,
    outputPricePer1MTokenUSD: 9.6,
    ...(() => {
      const { base, final } = calcCost(1.15, 9.6)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4o",
    name: "🚀 Rhyno V4 Ultra",
    توضیحات: "مدل همه‌فن‌حریف با سرعت و دقت بالا",
    inputPricePer1MTokenUSD: 5.15,
    outputPricePer1MTokenUSD: 19.6,
    ...(() => {
      const { base, final } = calcCost(5.15, 20.6)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4o-mini-tts",
    name: "🎤 Rhyno TTS",
    توضیحات: "نسخه صوتی Rhyno",
    inputPricePer1MTokenUSD: 2.15,
    outputPricePer1MTokenUSD: 25.6,
    ...(() => {
      const { base, final } = calcCost(2.15, 25.6)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },

  // --- Realtime ---
  {
    id: "gpt-realtime",
    name: "🎙️ Rhyno Live V1",
    توضیحات: "پاسخ زنده و فوری",
    inputPricePer1MTokenUSD: 60.0,
    outputPricePer1MTokenUSD: 100.0,
    ...(() => {
      const { base, final } = calcCost(60.0, 100.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-realtime-mini",
    name: "🎧 Rhyno Live Mini",
    توضیحات: "نسخه سبک برای پاسخ زنده",
    inputPricePer1MTokenUSD: 25.0,
    outputPricePer1MTokenUSD: 45.0,
    ...(() => {
      const { base, final } = calcCost(25.0, 45.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },

  // --- Audio ---
  {
    id: "gpt-audio",
    name: "🎵 Rhyno Audio",
    توضیحات: "پردازش صوتی پیشرفته",
    inputPricePer1MTokenUSD: 2.5,
    outputPricePer1MTokenUSD: 10.0,
    ...(() => {
      const { base, final } = calcCost(2.5, 10.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },

  // --- Image ---
  {
    id: "google/gemini-2.5-flash-image",
    name: "🖼️ Rhyno Image V2",
    توضیحات: "مدل جدید برای تولید تصویر",
    inputPricePer1MTokenUSD: 20.0,
    outputPricePer1MTokenUSD: 65.0,
    ...(() => {
      const { base, final } = calcCost(30.0, 70.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "dall-e-3",
    name: "🎨 Rhyno Image V1",
    توضیحات: "مدل پایه تولید تصویر",
    inputPricePer1MTokenUSD: 10.2,
    outputPricePer1MTokenUSD: 25.0,
    ...(() => {
      const { base, final } = calcCost(10.2, 25.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },

  // --- O series ---
  {
    id: "o1",
    name: "🌀 Rhyno O1",
    توضیحات: "مدل تحقیقاتی O1",
    inputPricePer1MTokenUSD: 30.0,
    outputPricePer1MTokenUSD: 90.0,
    ...(() => {
      const { base, final } = calcCost(30.0, 90.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "o1-pro",
    name: "🔥 Rhyno O1 Pro",
    توضیحات: "نسخه حرفه‌ای O1",
    inputPricePer1MTokenUSD: 500.0,
    outputPricePer1MTokenUSD: 1000.0,
    ...(() => {
      const { base, final } = calcCost(500.0, 1000.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "o1-mini",
    name: "💨 Rhyno O1 Mini",
    توضیحات: "نسخه کوچک O1",
    inputPricePer1MTokenUSD: 5.1,
    outputPricePer1MTokenUSD: 10.4,
    ...(() => {
      const { base, final } = calcCost(5.1, 10.4)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "o3",
    name: "⚡ Rhyno O3",
    توضیحات: "مدل قدرتمند سری O3",
    inputPricePer1MTokenUSD: 3.0,
    outputPricePer1MTokenUSD: 15.0,
    ...(() => {
      const { base, final } = calcCost(3.0, 15.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "o3-pro",
    name: "🚀 Rhyno O3 Pro",
    توضیحات: "نسخه حرفه‌ای O3",
    inputPricePer1MTokenUSD: 40.0,
    outputPricePer1MTokenUSD: 100.0,
    ...(() => {
      const { base, final } = calcCost(40.0, 100.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "o3-mini",
    name: "✨ Rhyno O3 Mini",
    توضیحات: "نسخه کوچک O3",
    inputPricePer1MTokenUSD: 20.1,
    outputPricePer1MTokenUSD: 50.4,
    ...(() => {
      const { base, final } = calcCost(20.1, 50.4)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "o3-deep-research",
    name: "🔍 Rhyno O3 Deep Research",
    توضیحات: "مدل مخصوص تحقیقات عمیق",
    inputPricePer1MTokenUSD: 50.0,
    outputPricePer1MTokenUSD: 90.0,
    ...(() => {
      const { base, final } = calcCost(50.0, 90.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "o4-mini",
    name: "🌟 Rhyno O4 Mini",
    توضیحات: "مدل کوچک سری O4",
    inputPricePer1MTokenUSD: 20.1,
    outputPricePer1MTokenUSD: 10.4,
    ...(() => {
      const { base, final } = calcCost(20.1, 10.4)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "o4-mini-deep-research",
    name: "🔎 Rhyno O4 Mini Deep Research",
    توضیحات: "نسخه تحقیقاتی O4 Mini",
    inputPricePer1MTokenUSD: 10.0,
    outputPricePer1MTokenUSD: 16.0,
    ...(() => {
      const { base, final } = calcCost(10.0, 16.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  // --- Computer use ---
  {
    id: "computer-use-preview",
    name: "💻 Rhyno Computer Use",
    توضیحات: "مدل مخصوص کارهای خودکار با کامپیوتر",
    inputPricePer1MTokenUSD: 20.0,
    outputPricePer1MTokenUSD: 120.0,
    ...(() => {
      const { base, final } = calcCost(20.0, 120.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  }
]
export const modelsWithRial = models // 👈 فقط همون مدل‌ها رو صادر کن
