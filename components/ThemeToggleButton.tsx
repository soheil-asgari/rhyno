// components/ThemeToggleButton.tsx
"use client"

import * as React from "react"
import { FiMoon, FiSun } from "react-icons/fi"
import { useTheme } from "next-themes"

export function ThemeToggleButton() {
  const { setTheme, theme } = useTheme()

  // این state برای جلوگیری از خطای هایدریشن (hydration mismatch) ضروری است
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    // تا قبل از mount شدن کامپوننت، یک نگه‌دارنده فضا رندر می‌کنیم
    return <div className="size-9 rounded-full p-2.5" />
  }

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      // ✅ استایل‌های کلید و آیکون‌ها
      className="relative rounded-full p-2.5 transition-colors duration-300 hover:bg-gray-200 dark:hover:bg-gray-800"
    >
      <FiSun className="size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <FiMoon className="absolute inset-0 m-auto size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
