import type { Metadata } from "next"
import AboutPageClient from "@/components/AboutPageClient" // فرض می‌کنیم کد UI شما در این فایل است

export const metadata: Metadata = {
  title: "درباره ما | Rhyno AI",
  description:
    "با داستان، ماموریت و ارزش‌های تیم Rhyno AI آشنا شوید. ما به ساخت آینده‌ای ساده‌تر و قدرتمندتر با هوش مصنوعی متعهدیم.",
  alternates: {
    canonical: "https://www.rhynoai.ir/about"
  }
}

// این کامپوننت روی سرور رندر می‌شود
export default function AboutPage() {
  return <AboutPageClient />
}
