// 🎯 مسیر فایل: app/layout.tsx (نسخه تست و بسیار ساده‌شده)

import { Metadata, Viewport } from "next"
import { Vazirmatn } from "next/font/google"
import { ReactNode } from "react"
import "./globals.css"

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-vazirmatn"
})

const SQUARE_LOGO_URL = "https://www.rhynoai.ir/rhyno-logo-square.jpg"

export const metadata: Metadata = {
  title: "Rhyno AI | مرکز فرماندهی هوش مصنوعی شما",
  description:
    "مرکز فرماندهی هوش مصنوعی شما – دسترسی سریع و ساده به مدل‌های قدرتمند AI با Rhyno AI."
}

export const viewport: Viewport = {
  themeColor: "#000000"
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Rhyno AI",
  url: "https://www.rhynoai.ir",
  logo: {
    "@type": "ImageObject",
    url: SQUARE_LOGO_URL
  }
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${vazirmatn.variable} font-vazir bg-black`}>
        {children}
      </body>
    </html>
  )
}
