// 🎯 مسیر فایل: components/HomePageClient.tsx

"use client"

import { motion, Variants } from "framer-motion"
import {
  FiArrowRight,
  FiCpu,
  FiLock,
  FiRepeat,
  FiZap,
  FiActivity,
  FiGlobe,
  FiTrendingUp,
  FiSmile,
  FiClock,
  FiImage,
  FiFileText,
  FiBookOpen
} from "react-icons/fi"
import React, { memo, useState, useEffect } from "react"
import AnimatedButton from "@/components/AnimatedButton"
import Image from "next/image"
import Lottie from "lottie-react"
import roboticsAnimation from "../public/animations/robotics.json"

// Hooks and helpers
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint)
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [breakpoint])
  return isMobile
}

interface SectionTitleProps {
  children: React.ReactNode
  className?: string
}

const SectionTitle = memo(({ children, className = "" }: SectionTitleProps) => (
  <h2
    className={`mb-8 text-center text-3xl font-bold text-white sm:text-4xl ${className}`}
  >
    {children}
  </h2>
))
SectionTitle.displayName = "SectionTitle"

SectionTitle.displayName = "SectionTitle"

const HeaderBrand: React.FC = () => (
  <div className="flex items-center space-x-2 rtl:space-x-reverse">
    <Image
      src="/rhyno1.png"
      width={40}
      height={40}
      priority
      alt="Rhyno Logo"
      className="rounded-full object-cover"
    />
    <span className="text-xl font-semibold text-white">Rhyno AI</span>
  </div>
)
HeaderBrand.displayName = "HeaderBrand"

const logos = [
  { name: "OpenAI" },
  { name: "Google AI" },
  { name: "Anthropic" },
  { name: "Grok" },
  { name: "Midjourney" },
  { name: "Perplexity" },
  { name: "Eleven Labs" }
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

// Main client component
export default function HomePageClient() {
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
            تست در دستان شما، سریع و بدون پیچیدگی.
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

        {/* Hero Image */}
        <Lottie
          animationData={roboticsAnimation}
          loop
          autoplay
          style={{
            width: "100%",
            maxWidth: 800, // حداکثر اندازه دسکتاپ
            height: "auto",
            margin: "0 auto"
          }}
        />

        {/* Trusted Logos Section */}
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
              },
              {
                icon: <FiActivity />,
                title: "به‌صرفه‌ترین",
                desc: "با کمترین هزینه از تمام امکانات استفاده کنید "
              },
              {
                icon: <FiGlobe />,
                title: "دسترسی جهانی",
                desc: "از هرجا و هر دستگاهی به سرویس متصل شوید"
              },
              {
                icon: <FiTrendingUp />,
                title: "مقیاس‌پذیری نامحدود",
                desc: "با رشد کسب‌وکارتان بدون نگرانی منابع را افزایش دهید"
              },
              {
                icon: <FiSmile />,
                title: "رابط کاربری لذت‌بخش",
                desc: "تجربه‌ای ساده، سریع و کاربرپسند برای همه"
              },
              {
                icon: <FiClock />,
                title: "مدل‌های Realtime",
                desc: "گفتگو و پردازش فوری، بدون هیچ تأخیر"
              },
              {
                icon: <FiImage />,
                title: "تولید تصویر",
                desc: "تصاویر خلاقانه و حرفه‌ای را تنها با چند کلمه بسازید"
              },
              {
                icon: <FiFileText />,
                title: "تولید فایل اکسل",
                desc: "خروجی‌های دقیق و ساختارمند در قالب فایل Excel"
              },
              {
                icon: <FiBookOpen />,
                title: "تحلیل فایل اکسل",
                desc: "خواندن و پردازش داده‌های اکسل برای تصمیم‌گیری بهتر"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-900 p-5 text-right transition-colors duration-300 hover:border-gray-600 hover:bg-gray-800 sm:p-6"
                initial={isMobile ? "visible" : "hidden"}
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: isMobile ? 0 : i * 0.1 }}
                variants={fadeInUp}
              >
                <div className="mb-3 flex justify-end text-white">
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
              <span
                dir="ltr"
                className="group relative cursor-help font-medium text-white"
              >
                pay as you go
                <span className="absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-1 text-sm text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  در این پلن فقط به اندازه استفاده‌تون پرداخت می‌کنید
                </span>
              </span>
            </p>

            <div className="mb-8 flex flex-wrap items-baseline justify-center gap-x-2">
              <span className="text-xl font-extrabold text-white sm:text-2xl md:text-3xl">
                برای اطلاعات بیشتر از تعرفه ها روی دکمه زیر کلیک کنید
              </span>
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

          {/* کد اینماد به صورت مستقیم و بدون بررسی تزریق می‌شود */}
          <div
            dangerouslySetInnerHTML={{
              __html: `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT' alt='نماد اعتماد الکترونیکی' style='cursor:pointer; width:125px; height:125px;' code='snXTJxUEZgVAphAqD5lpep29PJRZ2haT'></a>`
            }}
          />
        </div>
      </footer>
    </div>
  )
}
