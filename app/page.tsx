// 🎯 مسیر فایل: app/page.tsx

import HomePageClient from "@/components/HomePageClient"
import { Metadata } from "next"

// متادیتا برای صفحه اصلی (بدون تغییر)
export const metadata: Metadata = {
  title: "Rhyno AI | مرکز فرماندهی هوش مصنوعی شما",
  description:
    "مرکز فرماندهی هوش مصنوعی شما – دسترسی سریع و ساده به مدل‌های قدرتمند AI با Rhyno AI.",
  keywords: [
    "AI",
    "هوش مصنوعی",
    "مدل‌های AI",
    "Rhyno AI",
    "ابزار هوش مصنوعی",
    " هوش مصنوعی برای کسب و کار",
    "هوش مصنوعی کدنویسی",
    "هوش مصنوعی رایگان",
    "هوش مصنوعی تولید محتوا",
    "چت جی پی تی رایگان"
  ]
}

// ✅✅✅ تغییر اصلی اینجاست ✅✅✅
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Rhyno AI",
  url: "https://www.rhynoai.ir",
  logo: {
    "@type": "ImageObject",
    url: "https://www.rhynoai.ir/rhyno-logo-square.jpg"
  }
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        key="org-schema"
      />
      <HomePageClient />
    </>
  )
}
