import { Providers } from "@/components/utility/providers"
import TranslationsProvider from "@/components/utility/translations-provider"
import initTranslations from "@/lib/i18n"
import { Metadata, Viewport } from "next"
import localFont from "next/font/local" // تغییر از google به local
import { ReactNode } from "react"
import dynamic from "next/dynamic"
import "./globals.css"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

const ClientToaster = dynamic(
  () => import("@/components/utility/client-toaster"),
  { ssr: false }
)

// تعریف فونت وزیر متن به صورت محلی
const vazirmatn = localFont({
  src: "../public/fonts/Vazirmatn-VariableFont_wght.ttf", // مسیر فایل را چک کن
  display: "swap",
  variable: "--font-vazirmatn"
})

// تعریف فونت اینتر به صورت محلی
const inter = localFont({
  src: "../public/fonts/Inter-VariableFont_opsz,wght.ttf", // مسیر فایل را چک کن
  display: "swap",
  variable: "--font-inter"
})

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rhynoai.ir"),
  title: "Rhyno AI",
  description: "دستیار هوشمند فارسی"
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
  const { resources } = await initTranslations(locale, i18nNamespaces)

  return (
    <html
      lang={locale || "fa"}
      dir={locale === "en" ? "ltr" : "rtl"}
      suppressHydrationWarning
    >
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
                {children}
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
