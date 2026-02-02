import React, { memo } from "react"

export const StarryBackground = memo(() => (
  <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
    {/* این div پوشش اصلی است.
      'absolute inset-0' باعث می‌شود کل ارتفاع والد (که relative است) را بگیرد.
      'overflow-hidden' جلوی اسکرول‌بار اضافه را می‌گیرد.
      'z-0' آن را پشت محتوا (که z-10 است) قرار می‌دهد.
    */}
    <div className="stars"></div>
  </div>
))

StarryBackground.displayName = "StarryBackground"
