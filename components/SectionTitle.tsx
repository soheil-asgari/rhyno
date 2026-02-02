// components/SectionTitle.tsx
"use client"

import React, { memo, PropsWithChildren } from "react"
import Link from "next/link"
import { FiArrowLeft } from "react-icons/fi" // آیکون برای دکمه
import { cn } from "@/lib/utils"

// ۱. پراپ‌های جدید را به صورت اختیاری اضافه می‌کنیم
type SectionTitleProps = PropsWithChildren<{
  className?: string
  buttonText?: string // متن دکمه (اختیاری)
  buttonHref?: string // لینک دکمه (اختیاری)
}>

export const SectionTitle = memo(
  ({ children, className, buttonText, buttonHref }: SectionTitleProps) => (
    // ۲. یک div والد اضافه می‌کنیم تا عنوان و دکمه را مدیریت کند
    <div
      className={cn(
        "mb-12 flex w-full items-center gap-4",
        // ۳. اگر دکمه وجود داشت، عنوان را به یک سمت و دکمه را به سمت دیگر می‌برد
        //    اگر دکمه نبود، عنوان را در وسط قرار می‌دهد
        buttonHref ? "justify-between" : "justify-center"
      )}
    >
      {/* خود عنوان (تگ h2) */}
      <h2
        className={cn(
          "text-3xl font-bold text-black transition-colors duration-300 sm:text-4xl lg:text-5xl dark:text-white",
          className
        )}
      >
        {children}
      </h2>

      {/* ۴. دکمه را فقط در صورتی که متن و لینک داشته باشد، نمایش می‌دهد */}
      {buttonText && buttonHref && (
        <Link
          href={buttonHref}
          className="group flex shrink-0 items-center gap-1.5 text-sm font-medium text-blue-500 transition-colors hover:text-blue-400"
        >
          <span>{buttonText}</span>
          {/* آیکون فلش (چون سایت فارسی است، فلش به چپ به معنی "ادامه" است) */}
          <FiArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
        </Link>
      )}
    </div>
  )
)

SectionTitle.displayName = "SectionTitle"
