// 🎯 مسیر فایل: app/layout.tsx

import { GlobalState } from "@/components/utility/global-state"
import { Providers } from "@/components/utility/providers"
import TranslationsProvider from "@/components/utility/translations-provider"
import initTranslations from "@/lib/i18n"
import { Database } from "@/supabase/types"
import { createServerClient } from "@supabase/ssr"
import { Metadata, Viewport } from "next"
import { Inter, Vazirmatn } from "next/font/google"
import { cookies } from "next/headers"
import { ReactNode } from "react"
import dynamic from "next/dynamic"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
const ClientToaster = dynamic(
  () => import("@/components/utility/client-toaster"),
  { ssr: false }
)

// ... (کد فونت‌ها و metadata ... همان قبلی)
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
const APP_DEFAULT_TITLE = "Rhyno AI | مرکز فرماندهی هوش مصنوعی شما"
const APP_DESCRIPTION =
  "مرکز فرماندهی هوش مصنوعی شما – دسترسی سریع و ساده به مدل‌های قدرتمند AI با Rhyno AI."
const OG_IMAGE_URL = "https://www.rhynoai.ir/rhyno-logo-square.jpg"

export const metadata: Metadata = {
  title: { default: APP_DEFAULT_TITLE, template: "%s | Rhyno AI" },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.json",
  alternates: { canonical: "https://www.rhynoai.ir" },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.png"
  },
  openGraph: {
    title: APP_DEFAULT_TITLE,
    description: APP_DESCRIPTION,
    url: "https://www.rhynoai.ir",
    siteName: APP_NAME,
    images: [{ url: OG_IMAGE_URL, width: 1200, height: 630, alt: "Rhyno AI" }],
    locale: "fa_IR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: APP_DEFAULT_TITLE,
    description: APP_DESCRIPTION,
    images: [OG_IMAGE_URL]
  }
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
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
  // ... (کد supabase و session ... همان قبلی)
  const { locale } = params
  const cookieStore = cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )

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
      {/* ... (تگ‌های <link> فونت ... همان قبلی) ... */}
      <link
        rel="preload"
        href="/_next/static/media/vazirmatn-arabic-400-normal.f37c0063.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/_next/static/media/vazirmatn-latin-400-normal.344759ea.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />

      {/* تگ‌های CSS دستی که 404 می‌دادند حذف شده‌اند */}

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

            {/* 👇 ==== اصلاح اصلی اینجاست ==== 👇
              1. کلاس 'items-center' حذف شد (تا محتوا در عرض کامل کش بیاید).
              2. یک 'div' جدید با 'flex-1' اضافه شد تا زنجیره ارتفاع حفظ شود.
            */}
            <div className="bg-background text-foreground flex h-dvh flex-col overflow-x-auto">
              {/* این div جدید فرزند flex-col است و رشد می‌کند (flex-1) */}
              <div className="min-h-0 w-full flex-1">
                {session ? <GlobalState>{children}</GlobalState> : children}
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
