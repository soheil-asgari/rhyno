import { Metadata } from "next"
import CompanyLandingClient from "@/components/CompanyLandingClient" // مسیری که کامپوننت مرحله ۲ را ساختید

// ✅ تنظیم کش برای سرعت بالا (اختیاری ولی توصیه شده)
export const revalidate = 3600

// ✅✅✅ تنظیمات حیاتی SEO برای صفحه اصلی شرکتی ✅✅✅
export const metadata: Metadata = {
  title: {
    default: "رای‌نو | شرکت توسعه هوش مصنوعی و تحلیل داده سازمانی",
    template: "%s | Rhyno AI"
  },
  description:
    "ارائه دهنده راهکارهای سازمانی هوش مصنوعی، داشبوردهای مدیریتی Power BI، تحلیل کلان داده (Big Data) و توسعه نرم‌افزارهای هوشمند تجاری.",
  keywords: [
    "شرکت هوش مصنوعی",
    "خدمات هوش تجاری",
    "طراحی داشبورد Power BI",
    "مشاوره هوش مصنوعی سازمانی",
    "تحلیل داده",
    "Data Mining Iran",
    "هوش مصنوعی برای کسب و کار",
    "اتوماسیون اداری هوشمند",
    "Rhyno AI"
  ],
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: "https://www.rhynoai.ir",
    title: "رای‌نو | تحول دیجیتال با هوش مصنوعی",
    description:
      "شریک استراتژیک شما در پیاده‌سازی هوش مصنوعی و تحلیل داده‌های سازمانی.",
    siteName: "Rhyno AI",
    images: [
      {
        url: "https://www.rhynoai.ir/rhyno-logo-square.jpg", // تصویر شاخص برای اشتراک‌گذاری
        width: 1200,
        height: 630,
        alt: "Rhyno AI Enterprise Solutions"
      }
    ]
  },
  alternates: {
    canonical: "https://www.rhynoai.ir"
  }
}

// ✅ اسکیما مارک‌آپ (JSON-LD) برای درک بهتر گوگل از ماهیت شرکت
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization", // تغییر از WebSite به Organization برای صفحه شرکتی
  name: "Rhyno AI",
  url: "https://www.rhynoai.ir",
  logo: "https://www.rhynoai.ir/rhyno-logo-square.jpg",
  description: "شرکت پیشرو در ارائه راهکارهای هوش مصنوعی و تحلیل داده سازمانی",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+98-21-00000000", // شماره تماس شرکت را وارد کنید
    contactType: "sales",
    areaServed: "IR",
    availableLanguage: ["Persian", "English"]
  },
  sameAs: [
    "https://www.linkedin.com/company/rhynoai",
    "https://www.instagram.com/rhynoai"
    // سایر شبکه‌های اجتماعی
  ]
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        key="org-schema"
      />
      {/* فراخوانی کامپوننت کلاینت */}
      <CompanyLandingClient />
    </>
  )
}
