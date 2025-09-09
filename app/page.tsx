// 🎯 مسیر فایل: app/page.tsx

import type { Metadata } from "next"
import HomePageClient from "@/components/HomePageClient"

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
    icon: "/favicon.ico"
  },
  openGraph: {
    title: "Rhyno AI | مرکز فرماندهی هوش مصنوعی شما",
    description: "دسترسی سریع و ساده به مدل‌های قدرتمند AI با Rhyno AI.",
    url: "https://rhynoai.ir",
    siteName: "Rhyno AI",
    images: [
      {
        url: "https://rhynoai.ir/rhyno_white.png",
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
    images: ["https://rhynoai.ir/rhyno_white.png"]
  },
  alternates: {
    canonical: "https://rhynoai.ir"
  }
}

// این کامپوننت روی سرور رندر می‌شود و برای موتورهای جستجو عالی است
export default function Page() {
  return <HomePageClient />
}
