"use client"

// import { SessionProvider } from "next-auth/react" // <-- این خط را حذف یا کامنت کنید

import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { SWRConfig } from "swr"

const swrConfig = {
  revalidateOnFocus: false
}

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    // SessionProvider از اینجا حذف شد
    <SWRConfig value={swrConfig}>
      <NextThemesProvider {...props}>
        <TooltipProvider>{children}</TooltipProvider>
      </NextThemesProvider>
    </SWRConfig>
  )
}
