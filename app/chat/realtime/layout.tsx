import React from "react"

// این یک layout حداقلی است که جایگزین layout اصلی (که باعث خطای uuid می‌شد) می‌شود.
// این فایل نباید تگ‌های <html> یا <body> را رندر کند.
// این فایل فقط فرزندان (یعنی page.tsx) را برمی‌گرداند.
export default function RealtimeChatLayout({
  children
}: {
  children: React.ReactNode
}) {
  // ما فقط فرزند را برمی‌گردانیم تا در layout ریشه (root layout) اصلی برنامه رندر شود.
  return <>{children}</>
}
