"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { SWRConfig } from "swr"
// ۱. این دو مورد را ایمپورت کنید
import { ChatbotUIProvider } from "@/context/provider"
import { GlobalState } from "@/components/utility/global-state"

const swrConfig = {
  revalidateOnFocus: false
}

export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <SWRConfig value={swrConfig}>
      <NextThemesProvider {...props}>
        <TooltipProvider>
          {/* ۲. برنامه را داخل این پرووایدرها قرار دهید */}
          <ChatbotUIProvider>
            <GlobalState>{children}</GlobalState>
          </ChatbotUIProvider>
        </TooltipProvider>
      </NextThemesProvider>
    </SWRConfig>
  )
}
