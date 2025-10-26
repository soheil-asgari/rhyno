// app/company/page.tsx
"use client"

import React from "react"
import { motion } from "framer-motion"

// --- کامپوننت‌های مشترک ---
import { BentoCard, BentoCardContent } from "@/components/BentoCard"
import { SectionTitle } from "@/components/SectionTitle"
import { AnimatedGridPattern } from "@/components/AnimatedGridPattern"
import FaqSection from "@/components/FaqSection1"
import Header, { type NavLink } from "@/components/Header"
import { StarryBackground } from "@/components/StarryBackground" // <-- [جدید] ایمپورت کامپوننت ستاره‌ها

// --- آیکون‌ها ---
import {
  FiTarget,
  FiCpu,
  FiUsers,
  FiBarChart2,
  FiCheckCircle,
  FiSmartphone,
  FiMic,
  FiRotateCw,
  FiClipboard,
  FiCamera,
  FiActivity,
  FiTrendingUp,
  FiMessageSquare,
  FiThumbsUp
} from "react-icons/fi"
import { LuBrainCircuit } from "react-icons/lu"
import { GoGoal } from "react-icons/go"
import { HiOutlineUserGroup } from "react-icons/hi"

// --- داده‌های صفحه (بدون تغییر) ---
const clients = [
  "شرکت اول (مثال)",
  "استارتاپ دوم (مثال)",
  "هلدینگ سوم (مثال)",
  "شرکت فناوری چهارم"
]
const services = [
  {
    icon: <FiSmartphone size={28} />,
    title: "ساخت اپلیکیشن هوش مصنوعی اختصاصی",
    desc: "طراحی و توسعه اپلیکیشن‌های موبایل و وب مبتنی بر AI..."
  },
  {
    icon: <FiMic size={28} />,
    title: "ساخت دستیار هوشمند صوتی",
    desc: "پیاده‌سازی دستیارهای صوتی هوشمند (Voice Assistants)..."
  },
  {
    icon: <HiOutlineUserGroup size={28} />,
    title: "کارمند مجازی با هوش مصنوعی",
    desc: "ایجاد همکاران مجازی (AI Agents) برای انجام وظایف تکراری..."
  },
  {
    icon: <FiRotateCw size={28} />,
    title: "اتوماسیون هوشمند فرآیندها (RPA)",
    desc: "خودکارسازی فرآیندهای کسب‌وکار (BPA) و وظایف روتین..."
  },
  {
    icon: <FiClipboard size={28} />,
    title: "منشی و پاسخگوی هوشمند",
    desc: "توسعه سیستم‌های پاسخگویی خودکار، رزرواسیون و مدیریت جلسات..."
  },
  {
    icon: <FiCamera size={28} />,
    title: "بینایی ماشین و پردازش تصویر",
    desc: "تحلیل محتوای بصری، از شمارشگر هوشمند (Smart Counter)..."
  },
  {
    icon: <FiActivity size={28} />,
    title: "نظارت و بهینه‌سازی عملکرد",
    desc: "استفاده از AI برای تحلیل عملکرد کارکنان، کنترل کیفیت (QC)..."
  },
  {
    icon: <FiTrendingUp size={28} />,
    title: "تحلیل پیش‌بینی‌کننده (Predictive)",
    desc: "پیش‌بینی روندهای بازار، رفتار مشتریان و ریسک‌های عملیاتی..."
  },
  {
    icon: <FiMessageSquare size={28} />,
    title: "پردازش زبان طبیعی (NLP)",
    desc: "درک، تحلیل و تولید زبان انسانی برای چت‌بات‌ها..."
  },
  {
    icon: <FiThumbsUp size={28} />,
    title: "سیستم‌های توصیه‌گر (Recommender)",
    desc: "افزایش فروش و تعامل کاربر با ارائه پیشنهادات شخصی‌سازی شده."
  },
  {
    icon: <LuBrainCircuit size={28} />,
    title: "توسعه مدل‌های AI سفارشی",
    desc: "طراحی و پیاده‌سازی مدل‌های یادگیری عمیق (Deep Learning)..."
  },
  {
    icon: <FiUsers size={28} />,
    title: "مشاوره و استراتژی AI",
    desc: "ارائه خدمات مشاوره استراتژیک برای شناسایی فرصت‌ها..."
  }
]
const advantages = [
  "تمرکز بر ارائه راه‌حل‌های بومی‌سازی شده و دقیق",
  "تیم متخصص و با تجربه در لبه تکنولوژی AI",
  "پشتیبانی فنی قوی، ۲۴ ساعته و پاسخگو",
  "مقیاس‌پذیری بالا و زیرساخت بهینه و مقرون‌به‌صرفه",
  "تعهد کامل به امنیت داده‌ها و حفظ حریم خصوصی"
]

export default function CompanyPage() {
  const companyNavLinks: NavLink[] = [
    { href: "/", label: "خانه" },
    { href: "/about", label: "درباره ما" },
    { href: "/blog", label: "بلاگ" },
    { href: "/contact", label: "تماس با ما" }
  ]
  return (
    // ✅ [تغییر] آپدیت رنگ پس‌زمینه دارک
    <div className="font-vazir min-h-screen w-full overflow-x-hidden bg-white text-gray-800 transition-colors duration-300 dark:bg-[#0f1018] dark:text-gray-300">
      <Header navLinks={companyNavLinks} />
      <StarryBackground /> {/* <-- [جدید] اضافه کردن پس‌زمینه ستاره‌ای */}
      <AnimatedGridPattern />
      <main className="container relative z-10 mx-auto px-4 py-16 md:py-24">
        {/* --- بخش هیرو (معرفی) --- */}
        <section className="py-20 text-center md:py-24">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 bg-gradient-to-br from-blue-400 via-green-400 to-blue-500 bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-5xl md:text-6xl"
          >
            نوآوران هوش مصنوعی ارمغان
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mx-auto max-w-3xl text-base leading-relaxed text-gray-700 transition-colors duration-300 sm:text-lg dark:text-gray-400"
            dir="rtl"
          >
            ما در «نوآوران هوش مصنوعی ارمغان» با بهره‌گیری از آخرین دستاوردهای
            AI، راه‌حل‌های هوشمند، مقیاس‌پذیر و امنی را برای چالش‌های پیچیده
            کسب‌وکارهای ایرانی ارائه می‌دهیم.
          </motion.p>
        </section>

        {/* --- بخش اهداف و ماموریت --- */}
        <section id="mission" className="py-16 md:py-20">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <BentoCard className="h-full">
              <BentoCardContent
                icon={<GoGoal size={28} />}
                title="هدف و ماموریت ما"
                desc="ماموریت ما، دموکراتیزه کردن هوش مصنوعی برای کسب‌وکارهای ایرانی است..."
              />
            </BentoCard>
            <BentoCard className="h-full">
              <BentoCardContent
                icon={<FiTarget size={28} />}
                title="چشم‌انداز (Vision)"
                desc="چشم‌انداز ما تبدیل شدن به شریک اول تکنولوژی هوش مصنوعی برای سازمان‌ها در ایران و منطقه است..."
              />
            </BentoCard>
          </div>
        </section>

        {/* --- بخش خدمات و راه‌حل‌ها --- */}
        <section id="services" className="py-16 md:py-20">
          <SectionTitle>خدمات و راه‌حل‌های ما</SectionTitle>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => (
              <BentoCard key={i} className="h-full">
                <BentoCardContent {...service} />
              </BentoCard>
            ))}
          </div>
        </section>

        {/* --- بخش مزایا و مشتریان --- */}
        <section id="advantages" className="py-16 md:py-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7 }}
            >
              <SectionTitle className="text-right text-3xl md:text-4xl">
                مزایای همکاری با ارمغان AI
              </SectionTitle>
              <ul className="mt-8 space-y-4">
                {advantages.map((adv, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <FiCheckCircle className="shrink-0 text-green-400" />
                    <span className="text-gray-800 transition-colors duration-300 dark:text-gray-300">
                      {adv}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <SectionTitle className="text-right text-3xl md:text-4xl">
                همکاران تجاری ما
              </SectionTitle>
              <p
                className="mb-8 text-gray-700 transition-colors duration-300 dark:text-gray-400"
                dir="rtl"
              >
                ما افتخار همکاری و ارائه خدمات به شرکت‌های پیشرو در صنایع مختلف
                را داشته‌ایم...
              </p>
              <div className="flex flex-wrap gap-3">
                {clients.map((client, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-black/10 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:border-blue-400/50 hover:bg-blue-50 dark:border-white/20 dark:bg-gray-900/50 dark:text-gray-300 dark:hover:bg-blue-900/30"
                  >
                    {client}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* --- بخش سوالات متداول --- */}
        <FaqSection />
      </main>
    </div>
  )
}
