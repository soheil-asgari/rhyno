// components/AnimatedButton.tsx
"use client"

import React from "react"
import Link, { LinkProps } from "next/link"
import { motion } from "framer-motion"

// ✅ ۱. تعریف پراپ‌های جدید
// ما تمام پراپ‌های یک لینک (LinkProps) و تمام ویژگی‌های یک تگ <a>
// (مثل target, rel) را با هم ترکیب می‌کنیم.
type AnimatedButtonProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: React.ReactNode
    className?: string
  }

// ✅ ۲. کامپوننت آپدیت شده
// ما پراپ‌ها را با ...props دریافت می‌کنیم و به Link پاس می‌دهیم
export default function AnimatedButton({
  children,
  className,
  ...props // (href, target, rel و... همگی اینجا هستند)
}: AnimatedButtonProps) {
  return (
    // می‌توانید انیمیشن‌های خودتان را اینجا اضافه کنید
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
      <Link className={className} {...props}>
        {children}
      </Link>
    </motion.div>
  )
}
