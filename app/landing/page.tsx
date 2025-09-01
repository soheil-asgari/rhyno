"use client"

import { motion, Variants } from "framer-motion"
import { FiArrowRight, FiCpu, FiLock, FiRepeat, FiZap } from "react-icons/fi"
import React, { memo, useState, useEffect } from "react"
import AnimatedButton from "@/components/AnimatedButton"
import Image from "next/image"

// 💡 قدم ۱: تعریف کامل و صحیح هوک useIsMobile در همین فایل
// این هوک به ما اجازه می‌دهد تا انیمیشن‌ها را فقط در دسکتاپ اجرا کنیم.
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // این کد فقط در سمت کلاینت (مرورگر) اجرا می‌شود
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint)
    // اجرای اولیه برای تنظیم حالت صحیح
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [breakpoint])

  return isMobile
}

// کامپوننت عنوان بخش
const SectionTitle = memo(({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-8 text-center text-3xl font-bold text-white sm:text-4xl">
    {children}
  </h2>
))
SectionTitle.displayName = "SectionTitle"

// کامپوننت برند در هدر
const HeaderBrand: React.FC = () => (
  <div className="flex items-center space-x-2 rtl:space-x-reverse">
    <Image
      src="/rhyno1.png"
      width={40}
      height={40}
      alt="Rhyno Logo"
      className="rounded-full object-cover"
    />
    <span className="text-xl font-semibold text-white">Rhyno AI</span>
  </div>
)
HeaderBrand.displayName = "HeaderBrand"

// کامپوننت لوگوها
const logos = [
  { name: "OpenAI" },
  { name: "Google AI" },
  { name: "Anthropic" },
  { name: "Grok" },
  { name: "Midjourney" },
  { name: "Perplexity" }
]

const LogoTicker = memo(() => (
  <div className="relative w-full overflow-hidden py-6 [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]">
    <div className="animate-scroll flex will-change-transform">
      {[...logos, ...logos].map((logo, index) => (
        <div
          key={index}
          className="mx-4 shrink-0 whitespace-nowrap text-lg font-semibold text-gray-500 sm:mx-8 md:text-xl"
        >
          {logo.name}
        </div>
      ))}
    </div>
  </div>
))
LogoTicker.displayName = "LogoTicker"

// کامپوننت اصلی صفحه
export default function MinimalLandingPage() {
  const isMobile = useIsMobile()

  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  }

  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: isMobile ? 0.1 : 0.2 } }
  }

  return (
    // 💡 قدم ۲: اضافه کردن کمربند ایمنی برای جلوگیری قطعی از سرریز افقی
    <div
      className="font-vazir bg-background min-h-screen w-full overflow-x-hidden text-gray-300"
      dir="auto"
    >
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="border-b border-gray-800 py-4"
      >
        <nav className="container mx-auto flex items-center justify-between px-4">
          <HeaderBrand />
          <AnimatedButton
            href="/login"
            className="flex items-center space-x-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm font-bold text-black hover:bg-gray-800 hover:text-white sm:space-x-2 sm:px-4 sm:py-2 rtl:space-x-reverse"
          >
            <span className="hidden sm:inline">ورود به حساب</span>
            <span className="sm:hidden">ورود</span>
            <FiArrowRight />
          </AnimatedButton>
        </nav>
      </motion.header>

      <main className="container mx-auto px-4">
        {/* Hero Section */}
        <motion.section
          className="py-16 text-center md:py-24"
          initial={isMobile ? "visible" : "hidden"}
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={containerVariants}
        >
          <motion.h1
            className="mb-4 text-3xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl"
            variants={fadeInUp}
          >
            مرکز فرماندهی هوش مصنوعی شما
          </motion.h1>

          <motion.p
            className="mx-auto max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg"
            variants={fadeInUp}
            dir="rtl"
          >
            همه مدل‌های قدرتمند
            <span dir="ltr" className="inline">
              {" "}
              AI{" "}
            </span>
            در دستان شما، سریع و بدون پیچیدگی.
          </motion.p>

          <motion.div variants={fadeInUp} className="mt-8">
            <AnimatedButton
              href="#pricing"
              className="inline-block rounded-lg bg-white px-6 py-3 font-bold text-black hover:bg-gray-200"
            >
              شروع قدرتمند
            </AnimatedButton>
          </motion.div>
        </motion.section>

        {/* ================================================================ */}
        {/* 💡 بخش جدید برای نمایش عکس شما */}
        {/* این بخش بین دکمه "شروع قدرتمند" و متن "مورد اعتماد..." قرار می‌گیرد */}
        <motion.div
          className="my-1"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          whileHover={{ scale: 1.05 }} // 👈 بزرگ‌شدن هنگام هاور
        >
          <Image
            src="/rhyno_white.png"
            alt="Rhyno AI visual representation"
            width={1024}
            height={1024}
            className="w-55 mx-auto rounded-xl object-cover sm:w-48 md:w-80"
          />
        </motion.div>

        {/* ================================================================ */}

        <section className="py-8">
          <p className="mb-4 text-center text-sm font-bold text-gray-500">
            مورد اعتماد با استفاده از مدل‌های پیشرو
          </p>
          <LogoTicker />
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24">
          <SectionTitle>
            چرا <span dir="ltr">Rhyno AI</span> بهترین انتخاب است؟
          </SectionTitle>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <FiZap />,
                title: "سرعت بی‌نظیر",
                desc: "پاسخ‌ها را در کسری از ثانیه دریافت کنید"
              },
              {
                icon: <FiCpu />,
                title: "مدل‌های بهینه",
                desc: "بهترین عملکرد با مدل‌های بهینه و آماده استفاده"
              },
              {
                icon: <FiRepeat />,
                title: "تجربه یکپارچه",
                desc: "تمام ابزارها در یک داشبورد یکپارچه، مدیریت ساده‌تر"
              },
              {
                icon: <FiLock />,
                title: "امنیت کامل",
                desc: "امنیت و حریم خصوصی شما، اولویت ماست"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors duration-300 hover:border-gray-600 hover:bg-gray-800 sm:p-6"
                initial={isMobile ? "visible" : "hidden"}
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: isMobile ? 0 : i * 0.1 }}
                variants={fadeInUp}
              >
                <div className="mb-3 text-white">
                  {React.cloneElement(feature.icon, { className: "h-7 w-7" })}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 text-center md:py-24">
          <motion.div
            className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8 md:p-12"
            initial={
              isMobile ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }
            }
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h3 className="mb-2 text-2xl font-bold text-white">
              پلن دسترسی کامل
            </h3>
            <p className="mb-6 text-base text-gray-400" dir="rtl">
              همه ابزارها، همیشه و بدون محدودیت، با پلن{" "}
              <span dir="ltr" className="font-medium text-white">
                pay as you go
              </span>
            </p>
            <div className="mb-8 flex flex-wrap items-baseline justify-center gap-x-2">
              <span className="text-xl font-extrabold text-white sm:text-2xl md:text-3xl">
                برای اطلاعات بیشتر از تعرفه ها روی دکمه زیر کلیک کنید{" "}
              </span>
              {/* اصلاح شد: متن "/ ماهانه" اضافه شد */}
              <span className="text-base text-gray-400 sm:text-lg"></span>
            </div>
            <AnimatedButton
              href="/checkout"
              className="w-full rounded-lg bg-white px-6 py-3 font-bold text-black hover:bg-gray-200 sm:w-auto md:px-10 md:py-4"
            >
              تهیه اشتراک و شروع استفاده
            </AnimatedButton>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center">
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 px-4 sm:flex-row">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()}. تمامی حقوق محفوظ است.
          </p>
          <a
            referrerPolicy="origin"
            target="_blank"
            rel="noopener noreferrer"
            href="https://trustseal.enamad.ir/?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT"
          >
            <img
              referrerPolicy="origin"
              src="https://trustseal.enamad.ir/logo.aspx?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT"
              alt="نماد اعتماد الکترونیکی"
              className="h-12 cursor-pointer"
            />
          </a>
        </div>
      </footer>
    </div>
  )
}
