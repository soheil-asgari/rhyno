// components/LogoTicker.tsx
"use client"

import React, { memo } from "react"

// داده‌های لوگوها را هم به این فایل منتقل می‌کنیم
const logos = [
  "OpenAI",
  "Google AI",
  "Anthropic",
  "Grok",
  "Midjourney",
  "Perplexity",
  "Eleven Labs"
]

// کامپوننت را export می‌کنیم
export const LogoTicker = memo(() => (
  <div className="relative w-full overflow-hidden py-8 [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]">
    <div className="animate-scroll flex will-change-transform">
      {[...logos, ...logos].map((logo, index) => (
        <span
          key={index}
          // ✅ اصلاح رنگ متن برای لایت/دارک مود
          className="mx-6 shrink-0 whitespace-nowrap text-lg font-medium text-gray-600 transition-colors duration-300 sm:mx-10 md:text-xl dark:text-gray-500"
        >
          {logo}
        </span>
      ))}
    </div>
  </div>
))

LogoTicker.displayName = "LogoTicker"
