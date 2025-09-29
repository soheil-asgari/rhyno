// 🎯 مسیر فایل: app/page.tsx

import type { Metadata } from "next"
import HomePageClient from "@/components/HomePageClient"

// ✨ متادیتا برای تمیزتر شدن کد، ساده‌سازی شد
export const metadata: Metadata = {
  title: "Rhyno AI | مرکز فرماندهی هوش مصنوعی شما", // عنوان مخصوص صفحه اصلی
  description:
    "مرکز فرماندهی هوش مصنوعی شما – دسترسی سریع و ساده به مدل‌های قدرتمند AI با Rhyno AI.", // توضیحات مخصوص صفحه اصلی
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

// این کامپوننت روی سرور رندر می‌شود و برای موتورهای جستجو عالی است
export default function Page() {
  return <HomePageClient />
}
