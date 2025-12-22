// app/company/page.tsx
"use client"

import React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"

// --- کامپوننت‌های مشترک ---
import { BentoCard, BentoCardContent } from "@/components/BentoCard"
import { SectionTitle } from "@/components/SectionTitle"
import { AnimatedGridPattern } from "@/components/AnimatedGridPattern"
import FaqSection from "@/components/FaqSection1"
import Header, { type NavLink } from "@/components/Header"
import { StarryBackground } from "@/components/StarryBackground"
import { Button } from "@/components/ui/button"
import Testimonials from "@/components/Testimonials" // ✅ اضافه شده برای اثبات اجتماعی

// --- آیکون‌ها ---
import {
  FiTarget,
  FiUsers,
  FiCheckCircle,
  FiSmartphone,
  FiRotateCw,
  FiCamera,
  FiMessageSquare,
  FiDatabase,
  FiArrowLeft,
  FiAward,
  FiBriefcase,
  FiTrendingUp
} from "react-icons/fi"
import {
  LuBrainCircuit,
  LuLayoutDashboard,
  LuSearchCheck
} from "react-icons/lu"
import { GoGoal, GoRocket } from "react-icons/go"
import { HiOutlineUserGroup, HiOutlineLightBulb } from "react-icons/hi"

// --- داده‌های نمونه کارها (Portfolio) با جزئیات بیشتر ---
const portfolioItems = [
  {
    title: "داشبورد هوش تجاری هلدینگ مالی",
    category: "Power BI & Data Analysis",
    desc: "طراحی داشبورد جامع مدیریتی برای رصد لحظه‌ای شاخص‌های کلیدی عملکرد (KPIs)، جریان نقدینگی و پیش‌بینی سوددهی با دقت ۹۵٪.",
    tags: ["Power BI", "SQL Server", "Financial Modeling"],
    gradient: "from-yellow-400/20 to-orange-500/20"
  },
  {
    title: "سامانه کنترل تردد بیومتریک",
    category: "Computer Vision",
    desc: "پیاده‌سازی سیستم تشخیص چهره هوشمند برای کارخانجات صنعتی جهت ثبت ورود و خروج پرسنل با دقت ۹۹.۸٪ و حذف کارت‌های فیزیکی.",
    tags: ["Python", "OpenCV", "Deep Learning"],
    gradient: "from-blue-400/20 to-cyan-500/20"
  },
  {
    title: "چت‌بات پشتیبانی ۲۴/۷",
    category: "NLP & AI Agent",
    desc: "کاهش ۷۰٪ تیکت‌های ورودی با استفاده از مدل زبانی (LLM) اختصاصی که روی مستندات فنی شرکت آموزش دیده است.",
    tags: ["RAG", "LLM", "Customer Service"],
    gradient: "from-purple-400/20 to-pink-500/20"
  },
  {
    title: "پیش‌بینی تقاضای زنجیره تامین",
    category: "Predictive Analytics",
    desc: "بهینه‌سازی موجودی انبار و کاهش هزینه‌های دپو با استفاده از الگوریتم‌های یادگیری ماشین برای پیش‌بینی فروش آتی.",
    tags: ["Machine Learning", "Supply Chain", "Python"],
    gradient: "from-green-400/20 to-emerald-500/20"
  }
]

// --- داده‌های خدمات ---
const services = [
  {
    icon: <LuLayoutDashboard size={28} />,
    title: "هوش تجاری و داشبوردهای Power BI",
    desc: "تبدیل داده‌های پراکنده سازمان به داشبوردهای تعاملی و فارسی جهت رصد لحظه‌ای وضعیت کسب‌وکار."
  },
  {
    icon: <FiDatabase size={28} />,
    title: "تحلیل کلان‌داده (Big Data)",
    desc: "زیرساخت‌سازی، پاکسازی و تحلیل داده‌های حجیم برای کشف الگوهای پنهان و فرصت‌های جدید بازار."
  },
  {
    icon: <HiOutlineUserGroup size={28} />,
    title: "کارمند مجازی (AI Agents)",
    desc: "طراحی ایجنت‌های هوشمند برای انجام خودکار وظایف اداری، پاسخگویی به مشتریان و مدیریت ایمیل‌ها."
  },
  {
    icon: <LuBrainCircuit size={28} />,
    title: "توسعه مدل‌های AI اختصاصی",
    desc: "Fine-tune کردن مدل‌های زبانی و هوش مصنوعی بر روی داده‌های محرمانه و اختصاصی سازمان شما."
  },
  {
    icon: <FiRotateCw size={28} />,
    title: "اتوماسیون فرآیندها (RPA)",
    desc: "شناسایی گلوگاه‌های سازمانی و خودکارسازی فرآیندهای تکراری برای افزایش بهره‌وری و کاهش خطای انسانی."
  },
  {
    icon: <FiSmartphone size={28} />,
    title: "توسعه اپلیکیشن‌های هوشمند",
    desc: "طراحی نرم‌افزارهای موبایل و وب مجهز به قابلیت‌های هوش مصنوعی با تجربه کاربری مدرن."
  }
]

// --- داده‌های تیم (NEW) ---
const teamMembers = [
  {
    name: "سهیل عسگری", // فرض نام بر اساس نام پوشه فایل
    role: "بنیان‌گذار و مدیر فنی",
    image: "/avatars/avatar-2.png", // استفاده از فایل‌های موجود
    bio: "متخصص ارشد هوش مصنوعی با ۱۰ سال تجربه در پیاده‌سازی سیستم‌های کلان‌داده."
  },
  {
    name: "سارا جلالی",
    role: "مدیر محصول و استراتژی",
    image: "/avatars/avatar-3.png",
    bio: "مشاور دیجیتال مارکتینگ و متخصص طراحی تجربه کاربری محصولات داده‌محور."
  },
  {
    name: "امیرحسین راد",
    role: "توسعه‌دهنده ارشد بلاکچین و AI",
    image: "/avatars/avatar-2.png",
    bio: "طراح معماری‌های توزیع‌شده و متخصص پیاده‌سازی ایجنت‌های هوشمند."
  },
  {
    name: "نیکی تهرانی",
    role: "تحلیل‌گر داده (Data Scientist)",
    image: "/avatars/avatar-1.png",
    bio: "متخصص آمار و احتمالات و مسلط به مصورسازی داده‌ها در Power BI."
  },
  {
    name: "ارمغان سعیدی",
    role: "مشاور ارشد",
    image: "/avatars/avatar-1.png",
    bio: "متخصص ای تی و  طراحی تجربه کاربری محصولات داده‌محور."
  }
]

// --- داده‌های آمار (NEW) ---
const stats = [
  { value: "+۵۰", label: "پروژه موفق سازمانی" },
  { value: "۹۸٪", label: "رضایت کارفرمایان" },
  { value: "+۳۰٪", label: "کاهش هزینه‌های عملیاتی" },
  { value: "۲۴/۷", label: "پشتیبانی فنی فعال" }
]

// --- مراحل کاری (Process) (NEW) ---
const workProcess = [
  {
    step: "۰۱",
    title: "نیازسنجی و مشاوره",
    desc: "تحلیل دقیق چالش‌های سازمان شما و امکان‌سنجی پیاده‌سازی AI.",
    icon: <LuSearchCheck size={24} />
  },
  {
    step: "۰۲",
    title: "طراحی استراتژی و مدل",
    desc: "انتخاب بهترین الگوریتم‌ها و طراحی معماری سیستم متناسب با داده‌های شما.",
    icon: <HiOutlineLightBulb size={24} />
  },
  {
    step: "۰۳",
    title: "پیاده‌سازی و استقرار",
    desc: "توسعه چابک نرم‌افزار و استقرار امن روی سرورهای شما (On-Premise یا Cloud).",
    icon: <FiBriefcase size={24} />
  },
  {
    step: "۰۴",
    title: "پشتیبانی و بهینه‌سازی",
    desc: "آموزش پرسنل، پایش مداوم سیستم و به‌روزرسانی مدل‌ها.",
    icon: <GoRocket size={24} />
  }
]

const advantages = [
  "ارائه داشبوردهای مدیریتی Power BI کاملاً فارسی و شمسی",
  "امنیت داده‌ها و استقرار مدل‌ها روی سرورهای داخلی (On-Premise)",
  "پشتیبانی فنی اختصاصی و آموزش پرسنل کارفرما",
  "تیم متخصص و با تجربه در لبه تکنولوژی AI و Data Science",
  "بازگشت سرمایه (ROI) سریع با بهینه‌سازی فرآیندها"
]

const clients = [
  "پتروشیمی خلیج فارس",
  "شرکت راه و ساختمانی آذریوردتبریز",
  "شرکت سازمایه"
]

export default function CompanyLandingClient() {
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
            شریک استراتژیک شما در عصر هوش مصنوعی
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 max-w-4xl bg-gradient-to-br from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-5xl md:text-7xl dark:from-blue-200 dark:via-white dark:to-blue-200"
          >
            تحول دیجیتال سازمان با <br />
            <span className="text-blue-600 dark:text-blue-400">
              هوش مصنوعی و تحلیل داده
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mx-auto max-w-3xl text-base leading-relaxed text-gray-600 sm:text-xl dark:text-gray-400"
            dir="rtl"
          >
            در «نوآوران هوش مصنوعی ارمغان»، ما فراتر از یک شرکت نرم‌افزاری
            هستیم. ما شریک رشد شما هستیم. با ترکیب قدرت
            <span className="font-semibold text-blue-600 dark:text-blue-300">
              {" "}
              Power BI{" "}
            </span>
            و مدل‌های پیشرفته
            <span className="font-semibold text-purple-600 dark:text-purple-300">
              {" "}
              Deep Learning
            </span>
            ، تصمیم‌گیری را از حدس و گمان به علم تبدیل می‌کنیم.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-8 flex flex-col gap-4 sm:flex-row"
          >
            <Link href="/contact">
              <Button className="h-12 min-w-[180px] rounded-xl px-8 text-lg shadow-lg shadow-blue-500/20">
                درخواست مشاوره
              </Button>
            </Link>
            <Link href="#portfolio">
              <Button
                variant="outline"
                className="h-12 min-w-[180px] rounded-xl border-gray-300 px-8 text-lg dark:border-gray-700"
              >
                مشاهده پروژه‌ها
              </Button>
            </Link>
          </motion.div>
        </section>

        {/* --- بخش آمار (Stats) --- */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative -mt-8 mb-20 overflow-hidden rounded-3xl bg-gray-50 px-6 py-10 md:px-12 dark:bg-[#13141d]"
        >
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="mb-2 text-3xl font-bold text-blue-600 md:text-4xl dark:text-blue-400">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* --- بخش ماموریت --- */}
        <section id="mission" className="py-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <BentoCard className="h-full border-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10">
              <BentoCardContent
                icon={<GoGoal size={32} />}
                title="ماموریت ما"
                desc="توانمندسازی مدیران ایرانی با ابزارهای نوین داده‌کاوی برای اتخاذ تصمیمات دقیق، سریع و سودآور در بازارهای رقابتی."
              />
            </BentoCard>
            <BentoCard className="h-full">
              <BentoCardContent
                icon={<FiTarget size={32} />}
                title="چشم‌انداز ۱۴۰۵"
                desc="تبدیل شدن به قطب اصلی پیاده‌سازی هوش مصنوعی سازمانی (Enterprise AI) و تحول دیجیتال در منطقه خاورمیانه."
              />
            </BentoCard>
          </div>
        </section>

        {/* --- بخش خدمات --- */}
        <section id="services" className="py-20">
          <div className="mb-12 text-center">
            <SectionTitle>خدمات و راهکارهای تخصصی</SectionTitle>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              چرخه کامل داده: از جمع‌آوری و تحلیل تا هوش مصنوعی مولد
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service, i) => (
              <BentoCard
                key={i}
                className="h-full transition-colors hover:border-blue-500/30 dark:hover:border-blue-400/30"
              >
                <BentoCardContent {...service} />
              </BentoCard>
            ))}
          </div>
        </section>

        {/* --- بخش فرآیند کاری (Process) --- */}
        <section id="process" className="py-20">
          <div className="mb-16 text-center">
            <SectionTitle>مسیر همکاری با ما</SectionTitle>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              چگونه ایده شما را به یک راهکار هوشمند تبدیل می‌کنیم؟
            </p>
          </div>

          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-4">
            {/* خط اتصال فرضی */}
            <div className="absolute left-0 top-12 hidden h-0.5 w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-blue-200 to-transparent md:block dark:via-blue-800" />

            {workProcess.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="z-10 mb-6 flex size-16 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-lg dark:border-blue-900 dark:bg-[#0f1018] dark:text-blue-400">
                  {item.icon}
                </div>
                <span className="mb-2 text-sm font-bold text-blue-500 opacity-80">
                  مرحله {item.step}
                </span>
                <h3 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="px-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* --- بخش نمونه کارها (Portfolio) --- */}
        <section id="portfolio" className="py-20">
          <div className="mb-12 flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="text-right">
              <SectionTitle className="text-right">
                پروژه‌های اجرا شده
              </SectionTitle>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                افتخار ما، ارزش‌آفرینی واقعی برای مشتریان است
              </p>
            </div>
            <Link
              href="/services"
              className="flex items-center gap-1 text-blue-500 hover:underline"
            >
              مشاهده کاتالوگ کامل <FiArrowLeft />
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
                className="group relative overflow-hidden rounded-3xl border border-black/5 bg-white p-1 dark:border-white/10 dark:bg-black/20"
              >
                <div className="relative h-full overflow-hidden rounded-[20px] bg-white p-8 transition-colors dark:bg-[#13141d]">
                  {/* گرادینت پس‌زمینه */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-10 transition-opacity duration-500 group-hover:opacity-20`}
                  />

                  <div className="relative z-10">
                    <div className="mb-6 flex items-center justify-between">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-white/5 dark:text-gray-300">
                        {item.category}
                      </span>
                      <FiAward className="text-gray-400" size={20} />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-gray-900 md:text-2xl dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mb-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                      {item.desc}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-medium text-blue-600 dark:text-blue-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* --- بخش تیم (Team) --- */}
        <section id="team" className="py-20">
          <div className="mb-12 text-center">
            <SectionTitle>تیم متخصص ما</SectionTitle>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              تیمی متشکل از نخبگان دانشگاهی و متخصصان با تجربه صنعت
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {teamMembers.map((member, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative text-center"
              >
                <div className="relative mx-auto mb-4 size-32 overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-lg transition-transform duration-300 group-hover:scale-105 dark:border-gray-800 dark:bg-gray-800">
                  {/* استفاده از Image برای پرفورمنس بهتر */}
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  {member.name}
                </h4>
                <p className="mb-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                  {member.role}
                </p>
                <p className="px-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {member.bio}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* --- بخش نظرات و اثبات اجتماعی (Integration) --- */}
        <section id="testimonials" className="py-10">
          <Testimonials />
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
                <h3 className="mb-6 text-2xl font-bold text-gray-900 md:text-3xl dark:text-white">
                  چرا برندهای بزرگ به ما اعتماد می‌کنند؟
                </h3>
                <ul className="space-y-5">
                  {advantages.map((adv, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                        <FiCheckCircle size={14} />
                      </div>
                      <span className="text-base text-gray-700 md:text-lg dark:text-gray-300">
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
                <h3 className="mb-6 text-2xl font-bold text-gray-900 md:text-3xl dark:text-white">
                  مشتریان ما
                </h3>
                <p className="mb-8 text-gray-600 dark:text-gray-400">
                  تجربه همکاری با سازمان‌های پیشرو، پشتوانه تخصص ماست.
                </p>
                <div className="flex flex-wrap gap-4">
                  {clients.map((client, i) => (
                    <div
                      key={i}
                      className="flex cursor-default select-none items-center justify-center rounded-xl border border-black/5 bg-white px-6 py-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5"
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

        {/* --- Call to Action (Enhanced) --- */}
        <section className="py-16 text-center">
          <div className="relative overflow-hidden rounded-3xl bg-blue-600 px-6 py-16 text-white shadow-2xl md:px-12">
            <div className="relative z-10 mx-auto max-w-3xl">
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <FiTrendingUp size={32} className="text-white" />
              </div>
              <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
                کسب‌وکار خود را به سطح بعدی ببرید
              </h2>
              <p className="mb-8 text-lg text-blue-100">
                آیا آماده‌اید تا از داده‌های خود برای افزایش سودآوری استفاده
                کنید؟
                <br className="hidden md:block" />
                همین امروز برای <b>مشاوره رایگان ۱۵ دقیقه‌ای</b> با متخصصان ما
                تماس بگیرید.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/contact">
                  <Button className="h-14 min-w-[200px] bg-white px-8 text-lg font-bold text-blue-700 hover:bg-gray-100">
                    تماس با واحد فروش
                  </Button>
                </Link>
                <Link href="/about">
                  <Button
                    variant="outline"
                    className="h-14 min-w-[200px] border-2 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    آشنایی بیشتر با ما
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-sm text-blue-200 opacity-80">
                پاسخگویی در کمتر از ۲ ساعت کاری
              </p>
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
