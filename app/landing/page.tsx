"use client"

import { motion, Variants } from "framer-motion"
import { FiArrowRight, FiCpu, FiLock, FiRepeat, FiZap } from "react-icons/fi"
import React, { memo } from "react"
import AnimatedButton from "@/components/AnimatedButton"
import { Brand } from "@/components/ui/brand"
import Image from "next/image"

// Reusable Section Title Component
const SectionTitle = memo(({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-12 text-center text-3xl font-bold text-white md:text-4xl">
    {children}
  </h2>
))
SectionTitle.displayName = "SectionTitle"

const HeaderBrand: React.FC = () => (
  <div className="flex items-center space-x-2 rtl:space-x-reverse">
    <Image
      src="/rhyno1.png"
      width={45}
      height={45}
      alt="Rhyno Logo"
      className="rounded-full object-cover"
    />
    <span className="text-xl font-semibold text-white">Rhyno AI</span>
  </div>
)
HeaderBrand.displayName = "HeaderBrand"

// Reusable Logo Ticker Component
const logos = [
  { name: "OpenAI" },
  { name: "Google AI" },
  { name: "Anthropic" },
  { name: "Grok" },
  { name: "Midjourney" },
  { name: "Perplexity" }
]

const LogoTicker = memo(() => (
  <div className="relative w-full overflow-hidden py-8 [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]">
    <div className="animate-scroll flex will-change-transform">
      {[...logos, ...logos].map((logo, index) => (
        <div
          key={index}
          className="mx-6 shrink-0 whitespace-nowrap text-xl font-semibold text-gray-500 transition-colors hover:text-gray-300 md:mx-10 md:text-2xl"
        >
          {logo.name}
        </div>
      ))}
    </div>
  </div>
))
LogoTicker.displayName = "LogoTicker"

// Main Component
export default function MinimalLandingPage() {
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
    visible: {
      transition: { staggerChildren: 0.2 }
    }
  }

  return (
    <div
      className="font-vazir bg-background min-h-screen text-gray-300"
      dir="auto"
    >
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="border-b border-gray-800 py-6"
      >
        <nav className="container mx-auto flex items-center justify-between px-4 md:px-6">
          <HeaderBrand />

          <AnimatedButton
            href="/login"
            className="flex items-center space-x-2 rounded-lg border border-gray-800 px-4 py-2 text-sm font-bold text-black hover:bg-gray-800 hover:text-white rtl:space-x-reverse"
          >
            <span>ورود به حساب کاربری</span>
            <FiArrowRight />
          </AnimatedButton>
        </nav>
      </motion.header>

      <main className="container mx-auto px-4 md:px-6">
        {/* Hero Section */}
        <motion.section
          className="pb-24 pt-16 text-center md:pt-20"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.3 }}
          variants={containerVariants}
        >
          <motion.h1
            className="mb-6 text-4xl font-extrabold leading-tight text-white md:text-6xl"
            variants={fadeInUp}
          >
            مرکز فرماندهی هوش مصنوعی شما
          </motion.h1>

          <motion.p
            className="mx-auto mb-10 max-w-2xl text-base text-gray-400 md:text-lg"
            variants={fadeInUp}
          >
            دسترسی یکپارچه و بهینه‌سازی شده به قدرتمندترین مدل‌های هوش مصنوعی
            جهان. بدون پیچیدگی، با حداکثر کارایی
          </motion.p>

          <motion.div variants={fadeInUp}>
            <AnimatedButton
              href="#pricing"
              className="inline-block rounded-lg bg-white px-6 py-3 font-bold text-black hover:bg-gray-200 md:px-8 md:py-4"
            >
              شروع قدرتمند
            </AnimatedButton>
          </motion.div>
        </motion.section>

        {/* Logo Ticker Section */}
        <section className="py-8">
          <p className="mb-4 text-center text-gray-500">
            مورد اعتماد توسعه‌دهندگان با استفاده از مدل‌های پیشرو
          </p>
          <LogoTicker />
        </section>

        {/* Features Section */}
        <section className="py-20 md:py-24">
          <SectionTitle>
            چرا <span dir="ltr">Rhyno AI</span> بهترین انتخاب است؟
          </SectionTitle>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <FiZap />,
                title: "سرعت بی‌نظیر",
                desc: "پاسخ‌ها را با کمترین تأخیر ممکن دریافت کنید."
              },
              {
                icon: <FiCpu />,
                title: "مدل‌های بهینه",
                desc: "اکانت‌ها برای بهترین عملکرد ممکن تنظیم شده‌اند."
              },
              {
                icon: <FiRepeat />,
                title: "تجربه یکپارچه",
                desc: "تمام ابزارهای خود را در یک داشبورد واحد مدیریت کنید."
              },
              {
                icon: <FiLock />,
                title: "امنیت کامل",
                desc: "حریم خصوصی شما اولویت اول ماست."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-900 p-6 transition-all duration-300 hover:border-gray-600 hover:bg-gray-800 hover:shadow-lg"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="mb-4 text-white">
                  {React.cloneElement(feature.icon, { className: "w-8 h-8" })}
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
        <section id="pricing" className="py-20 md:py-24">
          <motion.div
            className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center md:p-12"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h3 className="mb-2 text-center text-2xl font-bold text-white">
              پلن دسترسی کامل
            </h3>

            <p className="mb-8 text-center text-gray-400" dir="rtl">
              تمام ابزارها، بدون هیچ محدودیتی به صورت
              <span dir="ltr" className="font-medium text-white">
                {" "}
                pay as go{" "}
              </span>
            </p>

            <div className="mb-8 flex items-baseline justify-center gap-2">
              <span className="text-5xl font-extrabold text-white">
                500 هزار تومان
              </span>
              <span className="text-lg text-gray-400">/ ماهانه</span>
            </div>

            <AnimatedButton
              href="/checkout"
              className="w-full rounded-lg bg-white px-8 py-3 font-bold text-black hover:bg-gray-200 md:w-auto md:px-10 md:py-4"
            >
              تهیه اشتراک و شروع استفاده
            </AnimatedButton>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-gray-800 py-10 text-center">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* متن حقوق */}
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()}. تمامی حقوق محفوظ است.
          </p>
          {/* نماد اعتماد پایین صفحه */}
          <div className="mt-4 flex justify-center sm:mt-0">
            <a
              referrerPolicy="origin"
              target="_blank"
              rel="noopener"
              href="https://trustseal.enamad.ir/?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT"
            >
              <img
                referrerPolicy="origin"
                src="https://trustseal.enamad.ir/logo.aspx?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT"
                alt="نماد اعتماد الکترونیکی"
                className="h-12 cursor-pointer" // ارتفاع دلخواه
              />
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
