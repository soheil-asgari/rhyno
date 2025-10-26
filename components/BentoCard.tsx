// components/BentoCard.tsx
"use client"

import React, { useRef, PropsWithChildren } from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"

export const BentoCard = ({
  className = "",
  children
}: PropsWithChildren<{ className?: string }>) => {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springConfig = { damping: 20, stiffness: 150 }
  const smoothMouseX = useSpring(mouseX, springConfig)
  const smoothMouseY = useSpring(mouseY, springConfig)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const { left, top } = ref.current.getBoundingClientRect()
    mouseX.set(e.clientX - left)
    mouseY.set(e.clientY - top)
  }

  const backgroundGlow = useTransform(
    [smoothMouseX, smoothMouseY],
    ([x, y]) =>
      `radial-gradient(600px circle at ${x}px ${y}px, rgba(59, 130, 246, 0.15), transparent 80%)`
  )

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      // ✅ آپدیت کلاس‌های بوردر و پس‌زمینه
      className={cn(
        "group relative rounded-2xl border border-black/10 bg-white/5 p-1 backdrop-blur-sm transition-colors duration-300 dark:border-white/10 dark:bg-black/20",
        className
      )}
    >
      {/* افکت هاور گرادینت - بدون تغییر */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/50 to-green-500/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* ✅ آپدیت پس‌زمینه داخلی کارت */}
      <div className="relative size-full rounded-[15px] bg-white/80 p-6 transition-colors duration-300 dark:bg-gray-950/80">
        {/* ✅ افکت درخشش موس (فقط در دارک مود) */}
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-[15px] opacity-0 transition-opacity duration-300 group-hover:opacity-0 dark:group-hover:opacity-100"
          style={{ background: backgroundGlow }}
        />
        <div className="relative z-10 h-full">{children}</div>
      </div>
    </motion.div>
  )
}

export const BentoCardContent = ({
  icon,
  title,
  desc
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) => (
  <div>
    {/* آیکون - بدون تغییر */}
    <div className="mb-3 text-blue-400">
      {React.cloneElement(icon as React.ReactElement, {
        className:
          "h-7 w-7 transition-transform duration-300 group-hover:scale-110"
      })}
    </div>
    {/* ✅ آپدیت رنگ متن عنوان */}
    <h3 className="mb-2 text-lg font-semibold text-black transition-colors duration-300 dark:text-white">
      {title}
    </h3>
    {/* ✅ آپدیت رنگ متن توضیحات */}
    <p className="text-sm text-gray-700 transition-colors duration-300 dark:text-gray-400">
      {desc}
    </p>
  </div>
)
