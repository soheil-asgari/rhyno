// app/services/page.tsx

"use client"

import React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { SectionTitle } from "@/components/SectionTitle"
import {
  FiShield,
  FiTrendingUp,
  FiCheckCircle,
  FiPhoneCall,
  FiDownload,
  FiLayers,
  FiActivity,
  FiServer,
  FiPieChart // آیکون جدید برای BI
} from "react-icons/fi"
import { LuBrainCircuit, LuLayoutDashboard } from "react-icons/lu" // آیکون داشبورد
import { HiOutlineChip } from "react-icons/hi"

// --- داده‌ها بر اساس PDF و درخواست جدید ---

// ۱. خدمات پلتفرم (SaaS)
const platformFeatures = [
  {
    title: "دسترسی بدون محدودیت",
    desc: "دسترسی مستقیم و پرسرعت به مدل‌های جهانی (GPT-4, Claude) بدون نیاز به تغییر IP.",
    icon: <FiServer />
  },
  {
    title: "پرداخت Pay-as-you-go",
    desc: "شفافیت کامل در هزینه‌ها؛ تنها به اندازه مصرف خود پرداخت کنید.",
    icon: <FiActivity />
  },
  {
    title: "API اختصاصی",
    desc: "اتصال ساده ابزارها و اپلیکیشن‌های شما به قدرت هوش مصنوعی.",
    icon: <FiLayers />
  }
]

// ۲. خدمات سازمانی (B2B) - [آپدیت شده با BI]
const enterpriseServices = [
  {
    title: "هوش مصنوعی مولد (GenAI & NLP)",
    desc: "توسعه مدل‌های زبانی اختصاصی (LLM)، چت‌بات‌های متصل به دیتابیس سازمانی (RAG) و تحلیل احساسات مشتریان.",
    tags: ["RAG", "Chatbot", "Fine-Tuning"],
    colSpan: "md:col-span-2", // کارت عریض
    bgImage: "/images/services/gen-ai-brain.jpg"
  },
  {
    title: "هوش تجاری (Business Intelligence)", // ✅ آیتم جدید
    desc: "طراحی داشبوردهای مدیریتی تعاملی (Power BI)، یکپارچه‌سازی منابع داده و گزارش‌دهی هوشمند برای تصمیم‌گیری داده‌محور.",
    tags: ["Power BI", "SQL Server", "Data Viz"],
    colSpan: "md:col-span-1", // کارت معمولی
    bgImage: "/images/services/bi-dashboard.jpg"
  },
  {
    title: "بینایی ماشین (Computer Vision)",
    desc: "کنترل کیفیت هوشمند (QC) در خط تولید، نظارت بر ایمنی (HSE) و سیستم‌های پلاک‌خوان و تشخیص چهره.",
    tags: ["QC", "HSE", "Face ID"],
    colSpan: "md:col-span-1",
    bgImage: "/images/services/computer-vision-factory.jpg"
  },
  {
    title: "تحلیل پیش‌بینانه (Predictive Analytics)",
    desc: "پیش‌بینی فروش، تشخیص ریزش مشتری (Churn) و کشف تقلب‌های مالی با الگوریتم‌های یادگیری ماشین.",
    tags: ["Forecasting", "Fraud Detection"],
    colSpan: "md:col-span-1",
    bgImage: "/images/services/predictive-chart.jpg"
  },
  {
    title: "اتوماسیون هوشمند (RPA & IPA)",
    desc: "خودکارسازی کامل فرآیندهای تکراری اداری و مالی، و پردازش هوشمند اسناد (IDP/OCR).",
    tags: ["Automation", "OCR", "Workflow"],
    colSpan: "md:col-span-1",
    bgImage: "/images/services/automation-robot.jpg"
  }
]

// ۳. راهکارهای خاص (منشی و کارمند مجازی)
const specificSolutions = [
  {
    title: "منشی هوشمند (Smart Secretary)",
    icon: <FiPhoneCall size={32} className="text-blue-500" />,
    items: [
      "پاسخگویی هوشمند به تماس‌ها (Smart IVR)",
      "تنظیم خودکار جلسات و تقویم",
      "رزرو منابع سازمانی و پاسخ به ایمیل‌ها"
    ]
  },
  {
    title: "کارمند مجازی (Virtual Employee)",
    icon: <LuBrainCircuit size={32} className="text-purple-500" />,
    items: [
      "تماس با لیست بدهکاران و پیگیری مطالبات",
      "سنجش رضایت مشتری و ثبت شکایات",
      "ورود داده‌ها و انتقال اطلاعات بین نرم‌افزارها"
    ]
  }
]

// ۴. چرا ما؟
const whyUs = [
  {
    label: "رویکرد سفارشی (Custom-Fit)",
    desc: "راهکارهای دقیقاً منطبق با CRM و ERP شما"
  },
  {
    label: "امنیت داده‌ها",
    desc: "زیرساخت On-Premise یا Cloud امن با رمزنگاری پیشرفته"
  },
  {
    label: "تمرکز بر ROI",
    desc: "تضمین بازگشت سرمایه و کاهش هزینه‌های عملیاتی"
  },
  { label: "تیم متخصص بومی", desc: "پشتیبانی سریع و درک عمیق از بازار ایران" }
]

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800 dark:bg-[#0f1018] dark:text-gray-300">
      {/* --- Hero Section --- */}
      <section className="relative overflow-hidden py-24 text-center md:py-32">
        {/* بک‌گراند */}
        <div className="absolute inset-0 z-0 opacity-10 dark:opacity-20">
          <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 text-4xl font-extrabold leading-tight text-gray-900 md:text-6xl dark:text-white"
          >
            مرکز فرماندهی <span className="text-blue-600">هوش مصنوعی</span> شما
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mb-8 max-w-3xl text-lg text-gray-600 md:text-xl dark:text-gray-400"
          >
            ما در Rhyno AI، پلی میان توانایی‌های بی‌نهایت هوش مصنوعی و نیازهای
            واقعی کسب‌وکار شما هستیم. از پلتفرم دسترسی سریع تا راهکارهای سازمانی
            پیچیده.
          </motion.p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button className="h-12 rounded-xl px-8 text-lg shadow-lg shadow-blue-500/20">
              درخواست دمو سازمانی
            </Button>
            {/* لینک دانلود کاتالوگ */}
            <a href="/rhyno-catalog.pdf" download target="_blank">
              <Button
                variant="outline"
                className="group h-12 gap-2 rounded-xl border-gray-300 px-8 text-lg dark:border-gray-700"
              >
                <FiDownload className="transition-transform group-hover:-translate-y-1" />
                دانلود کاتالوگ کامل (PDF)
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* --- Dual Strategy Section --- */}
      <section className="bg-gray-50 py-20 dark:bg-[#13141d]">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <SectionTitle>دو راهکار، یک هدف: توانمندسازی شما</SectionTitle>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              خدمات ما در دو بخش یکپارچه برای نیازهای متفاوت طراحی شده است
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Platform Card */}
            <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:shadow-md dark:border-gray-800 dark:bg-black/20">
              <div className="mb-6 inline-flex rounded-2xl bg-blue-100 p-4 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                <HiOutlineChip size={32} />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                ۱. پلتفرم Rhyno AI (SaaS)
              </h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                دسترسی یکپارچه به قدرتمندترین مدل‌های AI جهان برای توسعه‌دهندگان
                و تیم‌های چابک.
              </p>
              <ul className="space-y-4">
                {platformFeatures.map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 text-blue-500">{feat.icon}</div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">
                        {feat.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {feat.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Enterprise Card */}
            <div className="rounded-3xl border border-purple-200 bg-white p-8 shadow-sm transition-all hover:shadow-md dark:border-purple-900/30 dark:bg-black/20">
              <div className="mb-6 inline-flex rounded-2xl bg-purple-100 p-4 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                <FiShield size={32} />
              </div>
              <h3 className="mb-4 text-2xl font-bold">
                ۲. راهکارهای سازمانی (Enterprise)
              </h3>
              <p className="mb-6 text-gray-600 dark:text-gray-400">
                خدمات جامع B2B برای طراحی و پیاده‌سازی هوش مصنوعی اختصاصی، امن و
                مقیاس‌پذیر.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-white/5">
                  <h4 className="flex items-center gap-2 font-bold text-purple-600 dark:text-purple-400">
                    <LuBrainCircuit /> مشاوره و استراتژی
                  </h4>
                  <p className="mt-1 text-sm text-gray-500">
                    تدوین نقشه راه AI و امکان‌سنجی (PoC)
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 dark:bg-white/5">
                  <h4 className="flex items-center gap-2 font-bold text-purple-600 dark:text-purple-400">
                    <LuLayoutDashboard /> هوش تجاری (BI)
                  </h4>
                  <p className="mt-1 text-sm text-gray-500">
                    داشبوردهای مدیریتی و تحلیل داده
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Enterprise Services Detail (Bento Grid) --- */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <SectionTitle>خدمات تخصصی سازمانی</SectionTitle>
          {/* شبکه گرید برای نمایش خدمات */}
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {enterpriseServices.map((item, i) => (
              <div
                key={i}
                className={`group relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-100 transition-all hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 ${item.colSpan}`}
              >
                {/* Placeholder for Image/Gradient */}
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-200 to-gray-300 opacity-50 dark:from-gray-800 dark:to-gray-900" />

                {/* اگر عکس دارید، کد زیر را آنکامنت کنید */}
                {/* <Image src={item.bgImage} alt={item.title} fill className="object-cover opacity-20 transition-transform duration-500 group-hover:scale-105" /> */}

                <div className="relative z-10 flex h-full flex-col p-8">
                  <h3 className="mb-3 text-xl font-bold text-gray-900 md:text-2xl dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mb-6 grow text-sm leading-relaxed text-gray-700 md:text-base dark:text-gray-300">
                    {item.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full bg-white/60 px-3 py-1 text-xs font-medium backdrop-blur-sm dark:bg-black/40"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Specific Solutions (Secretary & Virtual Employee) --- */}
      <section className="bg-blue-600 py-20 text-white">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              همکاران دیجیتال جدید شما
            </h2>
            <p className="mt-4 text-blue-100">
              جایگزینی هوشمند برای کارهای تکراری و زمان‌بر
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {specificSolutions.map((sol, i) => (
              <div
                key={i}
                className="rounded-3xl bg-white/10 p-8 backdrop-blur-md transition-colors hover:bg-white/20"
              >
                <div className="mb-6 flex items-center gap-4">
                  <div className="rounded-xl bg-white p-3 shadow-lg">
                    {sol.icon}
                  </div>
                  <h3 className="text-2xl font-bold">{sol.title}</h3>
                </div>
                <ul className="space-y-4">
                  {sol.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <FiCheckCircle className="shrink-0 text-blue-300" />
                      <span className="text-lg">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Why Us --- */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <SectionTitle>چرا Rhyno AI؟</SectionTitle>
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {whyUs.map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                  <FiTrendingUp size={28} />
                </div>
                <h4 className="mb-2 text-lg font-bold">{item.label}</h4>
                <p className="text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- CTA Footer --- */}
      <section className="bg-gray-50 py-16 dark:bg-[#13141d]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-white">
            آماده شروع تحول دیجیتال هستید؟
          </h2>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/contact">
              <Button className="h-14 min-w-[200px] text-lg">
                درخواست مشاوره رایگان
              </Button>
            </Link>
            <a href="/rhyno-catalog.pdf" download target="_blank">
              <Button
                variant="outline"
                className="h-14 min-w-[200px] gap-2 text-lg"
              >
                <FiDownload /> دانلود کاتالوگ PDF
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
