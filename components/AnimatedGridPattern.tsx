// components/AnimatedGridPattern.tsx
"use client"

import React, { memo } from "react"

export const AnimatedGridPattern = memo(() => (
  <div className="pointer-events-none absolute inset-0 z-0">
    {/* ✅ افکت نور فقط در حالت دارک نمایش داده می‌شود */}
    <div
      className="absolute size-full bg-[radial-gradient(circle_at_center,rgba(100,116,139,0.1)_0%,rgba(100,116,139,0)_50%)] opacity-0 transition-opacity duration-300 dark:opacity-100"
      style={{
        animation: "pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      }}
    />
    {/* ✅ گرید در حالت لایت کم‌رنگ‌تر است */}
    <div className="absolute size-full bg-[url('/grid.svg')] bg-center opacity-30 transition-opacity duration-300 [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] dark:opacity-100"></div>
  </div>
))

AnimatedGridPattern.displayName = "AnimatedGridPattern"
