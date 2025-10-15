// 🎯 مسیر فایل: app/layout.tsx (نسخه نهایی و پاک‌سازی شده)

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
const OG_IMAGE_URL = "https://www.rhynoai.ir/rhyno-logo-google.png"

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
            <div className="bg-background text-foreground flex h-dvh flex-col items-center overflow-x-auto">
              {session ? <GlobalState>{children}</GlobalState> : children}
            </div>
            <Analytics />
          </TranslationsProvider>
        </Providers>
      </body>
    </html>
  )
}
