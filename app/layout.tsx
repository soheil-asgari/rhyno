// FILE: app/layout.tsx

import { GlobalState } from "@/components/utility/global-state"
import { Providers } from "@/components/utility/providers"
import TranslationsProvider from "@/components/utility/translations-provider"
import initTranslations from "@/lib/i18n"
import { Database } from "@/supabase/types"
import { createServerClient } from "@supabase/ssr"
import { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { cookies } from "next/headers"
import { ReactNode } from "react"
import dynamic from "next/dynamic"
import "./globals.css"

// ✨ FIX: Dynamically import our new client-side wrapper component
const ClientToaster = dynamic(
  () => import("@/components/utility/client-toaster"),
  {
    ssr: false
  }
)

const inter = Inter({ subsets: ["latin"] })
const APP_NAME = "Rhyno Chat"
const APP_DEFAULT_TITLE = "Rhyno Chat"
// ... (بقیه متادیتا و viewport بدون تغییر باقی می‌ماند)

export const metadata: Metadata = {
  applicationName: APP_NAME
  // ...
}
export const viewport: Viewport = {
  themeColor: "#000000"
}

const i18nNamespaces = ["translation"]

interface RootLayoutProps {
  children: ReactNode
  params: {
    locale: string
  }
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
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers attribute="class" defaultTheme="dark">
          <TranslationsProvider
            namespaces={i18nNamespaces}
            locale={locale}
            resources={resources}
          >
            {/* ✨ کامپوننت پوششی جدید را اینجا رندر می‌کنیم */}
            <ClientToaster />
            <div className="bg-background text-foreground flex h-dvh flex-col items-center overflow-x-auto">
              {session ? <GlobalState>{children}</GlobalState> : children}
            </div>
          </TranslationsProvider>
        </Providers>
      </body>
    </html>
  )
}
