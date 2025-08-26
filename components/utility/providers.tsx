"use client"

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
    <SWRConfig value={swrConfig}>
      <NextThemesProvider {...props}>
        <TooltipProvider>{children}</TooltipProvider>
      </NextThemesProvider>
    </SWRConfig>
  )
}
