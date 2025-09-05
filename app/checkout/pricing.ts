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

const RIAL_RATE = 100000

// مثال مصرف: 1500 ورودی، 3000 خروجی
const INPUT_TOKENS = 1500
const OUTPUT_TOKENS = 3000
const PROFIT_MARGIN = 1.4

const calcCost = (inputPrice: number, outputPrice: number) => {
  const base =
    (inputPrice * INPUT_TOKENS + outputPrice * OUTPUT_TOKENS) / 1_000_000
  const final = base * PROFIT_MARGIN
  return { base, final }
}

export const models: ModelPricing[] = [
  // --- GPT-5 family ---
  {
    id: "gpt-5",
    name: "🌌 Rhyno V5 Ultra",
    توضیحات: "جدیدترین مدل پرچمدار برای کارهای سنگین و دقیق",
    inputPricePer1MTokenUSD: 1.25,
    outputPricePer1MTokenUSD: 10.0,
    ...(() => {
      const { base, final } = calcCost(1.25, 10.0)
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
    inputPricePer1MTokenUSD: 0.25,
    outputPricePer1MTokenUSD: 2.0,
    ...(() => {
      const { base, final } = calcCost(0.25, 2.0)
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
    inputPricePer1MTokenUSD: 0.05,
    outputPricePer1MTokenUSD: 0.4,
    ...(() => {
      const { base, final } = calcCost(0.05, 0.4)
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
    outputPricePer1MTokenUSD: 10.0,
    ...(() => {
      const { base, final } = calcCost(1.25, 10.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },

  // --- GPT-4.1 family ---
  {
    id: "gpt-4.1",
    name: "🧠 Rhyno V4.1",
    توضیحات: "مدل هوشمند برای متن‌های پیچیده و طولانی",
    inputPricePer1MTokenUSD: 2.0,
    outputPricePer1MTokenUSD: 8.0,
    ...(() => {
      const { base, final } = calcCost(2.0, 8.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4.1-mini",
    name: "⚡ Rhyno V4.1 Mini",
    توضیحات: "نسخه سریع‌تر و ارزان‌تر V4.1",
    inputPricePer1MTokenUSD: 0.4,
    outputPricePer1MTokenUSD: 1.6,
    ...(() => {
      const { base, final } = calcCost(0.4, 1.6)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4.1-nano",
    name: "💨 Rhyno V4.1 Nano",
    توضیحات: "کم‌هزینه‌ترین نسخه V4.1",
    inputPricePer1MTokenUSD: 0.1,
    outputPricePer1MTokenUSD: 0.4,
    ...(() => {
      const { base, final } = calcCost(0.1, 0.4)
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
    name: "🚀 Rhyno V4 Omni",
    توضیحات: "مدل همه‌فن‌حریف با سرعت و دقت بالا",
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
  {
    id: "gpt-4o-mini",
    name: "✨ Rhyno V4 Omni Mini",
    توضیحات: "نسخه کوچک و سریع Omni",
    inputPricePer1MTokenUSD: 0.15,
    outputPricePer1MTokenUSD: 0.6,
    ...(() => {
      const { base, final } = calcCost(0.15, 0.6)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },

  // --- Realtime ---
  {
    id: "gpt-4o-realtime-preview",
    name: "🎙️ Rhyno Live Omni",
    توضیحات: "پاسخ زنده و فوری",
    inputPricePer1MTokenUSD: 40.0,
    outputPricePer1MTokenUSD: 80.0,
    ...(() => {
      const { base, final } = calcCost(40.0, 80.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  },
  {
    id: "gpt-4o-mini-realtime-preview",
    name: "🎧 Rhyno Live Omni Mini",
    توضیحات: "نسخه سبک برای پاسخ زنده",
    inputPricePer1MTokenUSD: 10.0,
    outputPricePer1MTokenUSD: 20.0,
    ...(() => {
      const { base, final } = calcCost(10, 20.0)
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
    id: "gpt-image-1",
    name: "🖼️ Rhyno Image V2",
    توضیحات: "مدل جدید برای تولید تصویر",
    inputPricePer1MTokenUSD: 5.0,
    outputPricePer1MTokenUSD: 15.0,
    ...(() => {
      const { base, final } = calcCost(5.0, 15.0)
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
    توضیحات: "مدل قبلی تولید تصویر",
    inputPricePer1MTokenUSD: 0.08,
    outputPricePer1MTokenUSD: 0.12,
    ...(() => {
      const { base, final } = calcCost(0.08, 0.12)
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
    inputPricePer1MTokenUSD: 15.0,
    outputPricePer1MTokenUSD: 60.0,
    ...(() => {
      const { base, final } = calcCost(15.0, 60.0)
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
    inputPricePer1MTokenUSD: 150.0,
    outputPricePer1MTokenUSD: 600.0,
    ...(() => {
      const { base, final } = calcCost(150.0, 600.0)
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
    inputPricePer1MTokenUSD: 1.1,
    outputPricePer1MTokenUSD: 4.4,
    ...(() => {
      const { base, final } = calcCost(1.1, 4.4)
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
    inputPricePer1MTokenUSD: 2.0,
    outputPricePer1MTokenUSD: 8.0,
    ...(() => {
      const { base, final } = calcCost(2.0, 8.0)
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
    inputPricePer1MTokenUSD: 20.0,
    outputPricePer1MTokenUSD: 80.0,
    ...(() => {
      const { base, final } = calcCost(20.0, 80.0)
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
    inputPricePer1MTokenUSD: 1.1,
    outputPricePer1MTokenUSD: 4.4,
    ...(() => {
      const { base, final } = calcCost(1.1, 4.4)
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
    inputPricePer1MTokenUSD: 10.0,
    outputPricePer1MTokenUSD: 40.0,
    ...(() => {
      const { base, final } = calcCost(10.0, 40.0)
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
    inputPricePer1MTokenUSD: 1.1,
    outputPricePer1MTokenUSD: 4.4,
    ...(() => {
      const { base, final } = calcCost(1.1, 4.4)
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
    inputPricePer1MTokenUSD: 2.0,
    outputPricePer1MTokenUSD: 8.0,
    ...(() => {
      const { base, final } = calcCost(2.0, 8.0)
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
    inputPricePer1MTokenUSD: 3.0,
    outputPricePer1MTokenUSD: 12.0,
    ...(() => {
      const { base, final } = calcCost(3.0, 12.0)
      return {
        costExampleUSD: base,
        finalCostUSD: final,
        finalCostRial: Math.round(final * RIAL_RATE)
      }
    })()
  }
]
export const modelsWithRial = models.map(model => ({
  ...model,
  costExampleRial: Math.round(model.costExampleUSD * RIAL_RATE),
  finalCostRial: Math.round(model.finalCostUSD * RIAL_RATE)
}))
