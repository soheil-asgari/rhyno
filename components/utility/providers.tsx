"use client"

import { SessionProvider } from "next-auth/react" // <-- ۱. این خط رو اضافه کنید
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { SWRConfig } from "swr"

// فقط یک قانون برای جلوگیری از رفرش شدن در زمان فوکوس نگه می‌داریم
const swrConfig = {
  revalidateOnFocus: false
}

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    // ۲. SessionProvider را به عنوان بیرونی‌ترین Provider قرار دهید
    <SessionProvider>
      <SWRConfig value={swrConfig}>
        <NextThemesProvider {...props}>
          <TooltipProvider>{children}</TooltipProvider>
        </NextThemesProvider>
      </SWRConfig>
    </SessionProvider>
  )
}
