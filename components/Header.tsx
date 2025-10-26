// components/Header.tsx
"use client"

import React, { useState, memo } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { FiArrowRight, FiMenu, FiX } from "react-icons/fi"
import AnimatedButton from "@/components/AnimatedButton"
import { ThemeToggleButton } from "@/components/ThemeToggleButton"

// --- کامپوننت برند هدر (بدون تغییر) ---
const HeaderBrand: React.FC = memo(() => (
  <Link href="/" className="flex items-center space-x-2 rtl:space-x-reverse">
    <Image
      src="/rhyno1.png"
      width={40}
      height={40}
      priority
      alt="Rhyno Logo"
      className="rounded-full object-cover"
    />
    <span className="text-xl font-semibold text-black transition-colors duration-300 dark:text-white">
      Rhyno AI
    </span>
  </Link>
))
HeaderBrand.displayName = "HeaderBrand"

// ✅ ۱. ما نوع (Type) لینک‌ها را export می‌کنیم تا بقیه صفحات از آن استفاده کنند
export type NavLink = {
  href: string
  label: string
}

// ❌ ۲. لیست ثابت navLinks از اینجا حذف شد

// ✅ ۳. کامپوننت Header اکنون navLinks را به عنوان یک prop دریافت می‌کند
export default function Header({ navLinks = [] }: { navLinks: NavLink[] }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-40 border-b border-black/10 bg-white/30 py-4 backdrop-blur-lg transition-colors duration-300 dark:border-white/10 dark:bg-black/30"
    >
      <nav className="container relative mx-auto flex items-center justify-between px-4">
        <HeaderBrand />

        {/* ✅ ۴. منوی دسکتاپ اکنون از navLinks (دریافتی از props) استفاده می‌کند */}
        <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center space-x-8 md:flex rtl:space-x-reverse">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-700 transition-colors hover:text-black dark:text-gray-400 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* دکمه‌های سمت چپ (بدون تغییر) */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggleButton />
          <div className="hidden md:block">
            <AnimatedButton
              href="/login"
              target="_blank"
              className="flex items-center space-x-1.5 rounded-lg border border-gray-300 bg-gray-900 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-gray-700 rtl:space-x-reverse dark:border-gray-700 dark:bg-white dark:text-black dark:hover:bg-gray-200"
            >
              <span>ورود به RhynoChat</span>
              <FiArrowRight />
            </AnimatedButton>
          </div>
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-black focus:outline-none dark:text-white"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ✅ ۵. منوی موبایل نیز از navLinks (دریافتی از props) استفاده می‌کند */}
      {isMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 flex flex-col items-center space-y-4 border-t border-black/10 bg-white/80 px-4 pt-4 md:hidden dark:border-white/10 dark:bg-black/80"
        >
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="w-full py-2 text-center text-gray-800 transition-colors hover:text-black dark:text-gray-300 dark:hover:text-white"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="https://rhynochat.com"
            target="_blank"
            className="w-full rounded-lg bg-blue-600 py-2.5 text-center font-bold text-white"
            onClick={() => setIsMenuOpen(false)}
          >
            ورود به RhynoChat
          </Link>
        </motion.div>
      )}
    </motion.header>
  )
}
