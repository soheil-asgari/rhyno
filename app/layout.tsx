// 🎯 مسیر فایل: app/layout.tsx

import { GlobalState } from "@/components/utility/global-state"
import { Providers } from "@/components/utility/providers"
import TranslationsProvider from "@/components/utility/translations-provider"
import initTranslations from "@/lib/i18n"
import { Database } from "@/supabase/types"
import { createClient as createSSRClient } from "@/lib/supabase/server"
import { Metadata, Viewport } from "next"
import { Inter, Vazirmatn } from "next/font/google"
import { cookies } from "next/headers"
import { ReactNode } from "react"
import dynamic from "next/dynamic"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

// ❗️ ۱. شما باید Provider را import کنید، نه Context را
import { ChatbotUIProvider } from "@/context/provider"

const ClientToaster = dynamic(
  () => import("@/components/utility/client-toaster"),
  { ssr: false }
)

// ... (کد فونت‌ها، metadata و viewport شما) ...
const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
  variable: "--font-vazirmatn"
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
})

const APP_NAME = "Rhyno AI"
export const metadata: Metadata = {
  // ✅ 1. دامنه اصلی سایت را اینجا تعریف کنید (برای حل مشکل تصاویر در لینکدین و توییتر)
  metadataBase: new URL("https://www.rhynoai.ir"),

  title: {
    default: "Rhyno AI | پلتفرم ابزارهای هوشمند فارسی",
    template: "%s | Rhyno AI" // این باعث می‌شود نام صفحات به صورت "نام مقاله | Rhyno AI" نمایش داده شود
  },
  description:
    "دستیار هوشمند فارسی و ابزارهای تولید محتوا، سئو و تحلیل داده با هوش مصنوعی.",

  // ✅ 2. تنظیمات Open Graph برای نمایش زیبا در تلگرام و واتس‌اپ
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: "https://www.rhynoai.ir",
    siteName: "Rhyno AI",
    images: [
      {
        url: "/rhyno-logo-square.jpg", // مطمئن شوید این عکس در پوشه public وجود دارد
        width: 1200,
        height: 630,
        alt: "Rhyno AI Platform"
      }
    ]
  },

  // ✅ 3. تنظیمات توییتر
  twitter: {
    card: "summary_large_image",
    title: "Rhyno AI",
    description: "پلتفرم هوش مصنوعی فارسی",
    images: ["/rhyno-logo-square.jpg"]
  },

  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },

  robots: {
    index: true,
    follow: true
  }
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // این خط باعث می‌شود کاربر نتواند زوم کند (حس اپلیکیشن واقعی)
  userScalable: false,
  // ✅ تنظیم رنگ نوار بالای مرورگر در موبایل (هماهنگ با لایت/دارک مود)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" }
  ]
}

const i18nNamespaces = ["translation"]

interface RootLayoutProps {
  children: ReactNode
  params: { locale: string }
}

export default async function RootLayout({
  children,
  params
}: RootLayoutProps) {
  const { locale } = params
  const cookieStore = cookies()
  const supabase = createSSRClient(cookieStore)

  const [sessionResponse, translationResponse] = await Promise.all([
    supabase.auth.getSession(),
    initTranslations(locale, i18nNamespaces)
  ])

  const {
    data: { session }
  } = sessionResponse
  const { resources } = translationResponse

  return (
    <html lang={locale || "fa"} dir="rtl" suppressHydrationWarning>
      <head />
      {/* ... (تگ‌های <link> فونت) ... */}
      <body
        className={`${vazirmatn.variable} ${inter.variable} font-vazir bg-black`}
      >
        <Providers attribute="class" defaultTheme="dark">
          <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
          >
            <ClientToaster />

            <div className="bg-background text-foreground flex h-dvh flex-col overflow-x-auto">
              <div className="flex min-h-0 w-full flex-1 flex-col">
                {session ? (
                  // ❗️ ۲. اینجا باید از Provider استفاده کنید
                  <ChatbotUIProvider>
                    <GlobalState>{children}</GlobalState>
                  </ChatbotUIProvider>
                ) : (
                  children
                )}
              </div>
            </div>
            <Analytics />
            <SpeedInsights />
          </TranslationsProvider>
        </Providers>
      </body>
    </html>
  )
}
