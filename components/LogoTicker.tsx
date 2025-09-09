"use client"

import { memo } from "react"

const logos = [
  "OpenAI",
  "Google AI",
  "Anthropic",
  "Grok",
  "Midjourney",
  "Perplexity",
  "Eleven Labs"
]

const LogoTicker = memo(() => (
  <div className="relative w-full overflow-hidden py-6 [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]">
    <div className="animate-scroll flex will-change-transform">
      {[...logos, ...logos].map((logo, index) => (
        <div
          key={index}
          className="mx-4 shrink-0 whitespace-nowrap text-lg font-semibold text-gray-500 sm:mx-8 md:text-xl"
        >
          {logo}
        </div>
      ))}
    </div>
  </div>
))
LogoTicker.displayName = "LogoTicker"

export default LogoTicker
