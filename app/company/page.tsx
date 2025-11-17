// app/company/page.tsx
"use client"

import React from "react"
import { motion } from "framer-motion"
import Link from "next/link"

// --- کامپوننت‌های مشترک ---
import { BentoCard, BentoCardContent } from "@/components/BentoCard"
import { SectionTitle } from "@/components/SectionTitle"
import { AnimatedGridPattern } from "@/components/AnimatedGridPattern"
import FaqSection from "@/components/FaqSection1"
import Header, { type NavLink } from "@/components/Header"
import { StarryBackground } from "@/components/StarryBackground"
import { Button } from "@/components/ui/button" // فرض بر وجود دکمه شادکن (Shadcn) یا دکمه سفارشی

// --- آیکون‌ها ---
import {
  FiTarget,
  FiUsers,
  FiBarChart2, // برای Power BI
  FiCheckCircle,
  FiSmartphone,
  FiMic,
  FiRotateCw,
  FiClipboard,
  FiCamera,
  FiActivity,
  FiTrendingUp,
  FiMessageSquare,
  FiThumbsUp,
  FiPieChart,
  FiDatabase,
  FiArrowLeft
} from "react-icons/fi"
import { LuBrainCircuit, LuLayoutDashboard } from "react-icons/lu"
import { GoGoal } from "react-icons/go"
import { HiOutlineUserGroup } from "react-icons/hi"

// --- داده‌های جدید: نمونه کارها (Portfolio) ---
const portfolioItems = [
  {
    title: "داشبورد هوش تجاری هلدینگ مالی",
    category: "Power BI & Data Analysis",
    desc: "طراحی داشبورد جامع مدیریتی برای رصد لحظه‌ای شاخص‌های کلیدی عملکرد (KPIs) و جریان نقدینگی.",
    tags: ["Power BI", "SQL Server", "Financial Modeling"],
    gradient: "from-yellow-400/20 to-orange-500/20"
  },
  {
    title: "سامانه احراز هویت بیومتریک",
    category: "Computer Vision",
    desc: "پیاده‌سازی سیستم تشخیص چهره و احراز هویت برای کنترل تردد کارکنان با دقت ۹۹.۸٪.",
    tags: ["Python", "OpenCV", "Deep Learning"],
    gradient: "from-blue-400/20 to-cyan-500/20"
  },
  {
    title: "چت‌بات هوشمند پشتیبانی مشتریان",
    category: "NLP & AI Agent",
    desc: "کاهش ۷۰٪ تیکت‌های ورودی با استفاده از مدل زبانی اختصاصی برای پاسخگویی خودکار.",
    tags: ["LLM", "RAG", "Customer Service"],
    gradient: "from-purple-400/20 to-pink-500/20"
  },
  {
    title: "پیش‌بینی تقاضا و مدیریت زنجیره تامین",
    category: "Predictive Analytics",
    desc: "استفاده از الگوریتم‌های یادگیری ماشین برای پیش‌بینی میزان فروش و بهینه‌سازی انبار.",
    tags: ["Machine Learning", "Supply Chain", "Python"],
    gradient: "from-green-400/20 to-emerald-500/20"
  }
]

// --- داده‌های خدمات (با اضافه شدن Power BI) ---
const services = [
  {
    icon: <LuLayoutDashboard size={28} />, // آیکون جدید
    title: "هوش تجاری و داشبوردهای Power BI", // سرویس جدید
    desc: "طراحی داشبوردهای مدیریتی تعاملی، مصورسازی داده‌ها و پیاده‌سازی راهکارهای BI برای تصمیم‌گیری داده‌محور."
  },
  {
    icon: <FiDatabase size={28} />, // آیکون جدید
    title: "تحلیل کلان‌داده (Big Data)",
    desc: "زیرساخت‌سازی و تحلیل داده‌های حجیم برای کشف الگوهای پنهان و بینش‌های تجاری ارزشمند."
  },
  {
    icon: <FiSmartphone size={28} />,
    title: "ساخت اپلیکیشن هوش مصنوعی",
    desc: "طراحی و توسعه اپلیکیشن‌های موبایل و وب مبتنی بر AI با رابط کاربری مدرن."
  },
  {
    icon: <HiOutlineUserGroup size={28} />,
    title: "کارمند مجازی (AI Agents)",
    desc: "ایجاد همکاران مجازی هوشمند برای انجام خودکار وظایف تکراری و اداری."
  },
  {
    icon: <FiRotateCw size={28} />,
    title: "اتوماسیون فرآیندها (RPA)",
    desc: "خودکارسازی فرآیندهای کسب‌وکار (BPA) برای افزایش بهره‌وری و کاهش خطا."
  },
  {
    icon: <FiMessageSquare size={28} />,
    title: "پردازش زبان طبیعی (NLP)",
    desc: "توسعه چت‌بات‌های پیشرفته، تحلیل احساسات و خلاصه‌سازی متون فارسی."
  },
  {
    icon: <LuBrainCircuit size={28} />,
    title: "توسعه مدل‌های AI اختصاصی",
    desc: "Fine-tune کردن مدل‌های زبانی و هوش مصنوعی روی داده‌های اختصاصی سازمان شما."
  },
  {
    icon: <FiCamera size={28} />,
    title: "بینایی ماشین (Computer Vision)",
    desc: "تحلیل هوشمند تصاویر دوربین‌ها، کنترل کیفیت خط تولید و تشخیص اشیاء."
  },
  {
    icon: <FiUsers size={28} />,
    title: "مشاوره استراتژی AI",
    desc: "نقشه‌ی راه تحول دیجیتال و پیاده‌سازی هوش مصنوعی در ساختار سازمان."
  }
]

const clients = [
  "پتروشیمی خلیج فارس",
  "گروه صنعتی انتخاب",
  "بانک آینده",
  "اسنپ",
  "دیجی‌کالا"
] // مثال: نام‌های واقعی یا فرضی معتبرتر جایگزین کنید

const advantages = [
  "ارائه داشبوردهای مدیریتی Power BI کاملاً فارسی و شمسی",
  "تیم متخصص و با تجربه در لبه تکنولوژی AI و Data Science",
  "امنیت داده‌ها و استقرار مدل‌ها روی سرورهای داخلی (On-Premise)",
  "پشتیبانی فنی اختصاصی و آموزش پرسنل کارفرما",
  "هزینه بهینه نسبت به راهکارهای خارجی با کیفیت مشابه"
]

export default function CompanyPage() {
  const companyNavLinks: NavLink[] = [
    { href: "/", label: "خانه" },
    { href: "/about", label: "درباره ما" },
    { href: "/blog", label: "بلاگ" },
    { href: "/contact", label: "تماس با ما" }
  ]

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white text-gray-800 transition-colors duration-300 dark:bg-[#0f1018] dark:text-gray-300">
      <Header navLinks={companyNavLinks} />

      {/* پس‌زمینه */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarryBackground />
        <AnimatedGridPattern />
      </div>

      <main className="container relative z-10 mx-auto px-4 py-16 md:py-24">
        {/* --- بخش هیرو (معرفی) --- */}
        <section className="flex flex-col items-center py-20 text-center md:py-32">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 rounded-full bg-blue-100/50 px-4 py-1.5 text-sm font-medium text-blue-600 backdrop-blur-sm dark:bg-blue-500/10 dark:text-blue-300"
          >
            شریک تجاری شما در عصر هوش مصنوعی
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 max-w-4xl bg-gradient-to-br from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-5xl md:text-7xl dark:from-blue-200 dark:via-white dark:to-blue-200"
          >
            تحول کسب‌وکار با <br />
            <span className="text-blue-600 dark:text-blue-400">
              داده‌ها و هوش مصنوعی
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mx-auto max-w-3xl text-base leading-relaxed text-gray-600 sm:text-xl dark:text-gray-400"
            dir="rtl"
          >
            در «نوآوران هوش مصنوعی ارمغان»، ما داده‌های خام شما را به بینش‌های
            استراتژیک تبدیل می‌کنیم. تخصص ما ترکیب قدرت{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-300">
              Power BI
            </span>{" "}
            و{" "}
            <span className="font-semibold text-purple-600 dark:text-purple-300">
              مدل‌های پیشرفته AI
            </span>{" "}
            برای ارتقای بهره‌وری سازمان شماست.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-8 flex gap-4"
          >
            <Link href="/contact">
              <Button className="h-12 rounded-xl px-8 text-lg">
                درخواست مشاوره رایگان
              </Button>
            </Link>
          </motion.div>
        </section>

        {/* --- بخش ماموریت --- */}
        <section id="mission" className="py-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <BentoCard className="h-full border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10">
              <BentoCardContent
                icon={<GoGoal size={32} />}
                title="ماموریت ما"
                desc="توانمندسازی سازمان‌های ایرانی با ابزارهای نوین داده‌کاوی و هوش مصنوعی جهت تصمیم‌گیری دقیق، سریع و سودآور."
              />
            </BentoCard>
            <BentoCard className="h-full">
              <BentoCardContent
                icon={<FiTarget size={32} />}
                title="چشم‌انداز ۱۴۰۵"
                desc="تبدیل شدن به مرجع اصلی پیاده‌سازی راهکارهای سازمانی هوش مصنوعی و داشبوردهای BI در خاورمیانه."
              />
            </BentoCard>
          </div>
        </section>

        {/* --- بخش خدمات (Updated) --- */}
        <section id="services" className="py-20">
          <div className="mb-12 text-center">
            <SectionTitle>خدمات و راهکارهای سازمانی</SectionTitle>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              راهکارهای جامع از تحلیل داده تا هوش مصنوعی مولد
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => (
              <BentoCard
                key={i}
                className="h-full hover:border-blue-500/30 dark:hover:border-blue-400/30"
              >
                <BentoCardContent {...service} />
              </BentoCard>
            ))}
          </div>
        </section>

        {/* --- بخش نمونه کارها (Portfolio - NEW) --- */}
        <section id="portfolio" className="py-20">
          <div className="mb-12 flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-right">
              <SectionTitle className="text-right">
                پروژه‌های برگزیده
              </SectionTitle>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                نمونه‌هایی از ارزش‌آفرینی ما برای مشتریان
              </p>
            </div>
            <Link
              href="/contact"
              className="flex items-center gap-1 text-blue-500 hover:underline"
            >
              مشاهده همه پروژه‌ها <FiArrowLeft />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {portfolioItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/20"
              >
                {/* گرادینت پس‌زمینه */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-30 transition-opacity duration-500 group-hover:opacity-50`}
                />

                <div className="relative z-10 p-8">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="rounded-full bg-white/50 px-3 py-1 text-xs font-semibold text-black backdrop-blur dark:bg-white/10 dark:text-white">
                      {item.category}
                    </span>
                    {/* اینجا می‌توانید آیکون یا لوگوی پروژه را قرار دهید */}
                  </div>
                  <h3 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mb-6 leading-relaxed text-gray-600 dark:text-gray-300">
                    {item.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs text-gray-500 dark:text-gray-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* --- بخش مزایا و مشتریان --- */}
        <section id="advantages" className="py-20">
          <div className="rounded-3xl bg-gray-50 p-8 md:p-12 dark:bg-[#13141d]">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h3 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
                  چرا ارمغان انتخاب اول سازمان‌هاست؟
                </h3>
                <ul className="space-y-5">
                  {advantages.map((adv, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                        <FiCheckCircle size={14} />
                      </div>
                      <span className="text-lg text-gray-700 dark:text-gray-300">
                        {adv}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h3 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
                  اعتماد پیشروان صنعت
                </h3>
                <p className="mb-8 text-gray-600 dark:text-gray-400">
                  همکاری با برترین برندها افتخار ماست. ما به کسب‌وکارهای بزرگ
                  کمک کرده‌ایم تا با داده‌هایشان صحبت کنند.
                </p>
                <div className="flex flex-wrap gap-4">
                  {clients.map((client, i) => (
                    <div
                      key={i}
                      className="flex select-none items-center justify-center rounded-xl border border-black/5 bg-white px-6 py-4 shadow-sm transition-transform hover:scale-105 dark:border-white/10 dark:bg-white/5"
                    >
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {client}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* --- Call to Action --- */}
        <section className="py-16 text-center">
          <div className="relative overflow-hidden rounded-3xl bg-blue-600 px-6 py-16 text-white shadow-2xl md:px-12">
            <div className="relative z-10 mx-auto max-w-3xl">
              <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
                آماده هوشمندسازی کسب‌وکار خود هستید؟
              </h2>
              <p className="mb-8 text-lg text-blue-100">
                همین امروز برای دریافت دمو رایگان داشبوردهای Power BI و مشاوره
                هوش مصنوعی با ما تماس بگیرید.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/contact">
                  <Button className="h-14 bg-white px-8 text-lg text-blue-700 hover:bg-gray-100">
                    تماس با واحد فروش
                  </Button>
                </Link>
                <Link href="/about">
                  <Button
                    variant="outline"
                    className="h-14 border-white text-white hover:bg-white/10 hover:text-white"
                  >
                    درباره تیم ما
                  </Button>
                </Link>
              </div>
            </div>
            {/* پترن پس‌زمینه CTA */}
            <div className="absolute -left-20 -top-20 size-64 rounded-full bg-blue-500 opacity-50 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 size-64 rounded-full bg-purple-600 opacity-50 blur-3xl" />
          </div>
        </section>

        {/* --- سوالات متداول --- */}
        <FaqSection />
      </main>
    </div>
  )
}
