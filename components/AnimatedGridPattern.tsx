// components/AnimatedGridPattern.tsx

import React, { memo } from "react"

export const AnimatedGridPattern = memo(() => (
  <div className="pointer-events-none absolute inset-0 z-0">
    {/* ✅ افکت نور */}
    <div
      // [تغییر اصلی] ✅ باید 'inset-0' باشد
      className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(100,116,139,0.1)_0%,rgba(100,116,139,0)_50%)] opacity-0 transition-opacity duration-300 dark:opacity-100"
      style={{
        animation: "pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      }}
    />
    {/* ✅ خطوط گرید */}
    <div
      // [تغییر اصلی] ✅ این هم باید 'inset-0' باشد
      className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30 transition-opacity duration-300 dark:opacity-100"
    ></div>
  </div>
))

AnimatedGridPattern.displayName = "AnimatedGridPattern"
