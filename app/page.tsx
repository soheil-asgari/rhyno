// 🎯 مسیر فایل: app/page.tsx

import type { Metadata } from "next"
import HomePageClient from "@/components/HomePageClient"

const LOGO_URL = "https://www.rhynoai.ir/rhyno_white.png"

// آبجکت متادیتا به روش مدرن و بهینه برای SEO
export const metadata: Metadata = {
  title: "Rhyno AI | مرکز فرماندهی هوش مصنوعی شما",
  description:
    "مرکز فرماندهی هوش مصنوعی شما – دسترسی سریع و ساده به مدل‌های قدرتمند AI با Rhyno AI.",
  keywords: ["AI", "هوش مصنوعی", "مدل‌های AI", "Rhyno AI", "ابزار هوش مصنوعی"],
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: "/favicon.ico" // favicon موجود در /public
  },
  openGraph: {
    title: "Rhyno AI | مرکز فرماندهی هوش مصنوعی شما",
    description: "دسترسی سریع و ساده به مدل‌های قدرتمند AI با Rhyno AI.",
    url: "https://www.rhynoai.ir",
    siteName: "Rhyno AI",
    images: [
      {
        url: LOGO_URL,
        width: 1200,
        height: 630,
        alt: "Rhyno AI Cover Image"
      }
    ],
    locale: "fa_IR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Rhyno AI | مرکز فرماندهی هوش مصنوعی شما",
    description: "دسترسی سریع و ساده به مدل‌های قدرتمند AI با Rhyno AI.",
    images: [LOGO_URL]
  },
  alternates: {
    canonical: "https://www.rhynoai.ir" // نسخه نهایی www + HTTPS
  }
}

// این کامپوننت روی سرور رندر می‌شود و برای موتورهای جستجو عالی است
export default function Page() {
  return <HomePageClient />
}
