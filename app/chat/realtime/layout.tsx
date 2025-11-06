import React from "react"

// این یک layout حداقلی است که جایگزین layout اصلی برنامه می‌شود
// و از خطای "invalid uuid" جلوگیری می‌کند.
export default function RealtimeChatLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        {/*
          ما فقط فرزند (page.tsx) را رندر می‌کنیم
          و هیچ‌کدام از کامپوننت‌های layout اصلی (مثل سایدبار و ...) را نمی‌خواهیم
        */}
        {children}
      </body>
    </html>
  )
}
