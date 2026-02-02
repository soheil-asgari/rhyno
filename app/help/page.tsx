"use client"

import React, { useState } from "react"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { models } from "../checkout/pricing"
import {
  FaChevronDown,
  FaBookOpen,
  FaPencilAlt,
  FaImage,
  FaMicrophone,
  FaDesktop,
  FaFlask
} from "react-icons/fa"
import Head from "next/head"

// =================================================================
// 1. انیمیشن‌ها
// =================================================================

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
    }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
}

const contentVariants: Variants = {
  hidden: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    marginTop: "16px",
    marginBottom: "16px",
    transition: {
      duration: 0.4,
      ease: "easeInOut"
    }
  }
}

// =================================================================
// 2. محتوای راهنما و مثال‌ها
// =================================================================

const getModelGuidance = (modelId: string) => {
  const commonGuidance = {
    general:
      "این مدل برای درک و تولید متن‌های پیچیده طراحی شده است. می‌توانید از آن برای خلاصه‌سازی، نوشتن محتوا، پاسخ به سوالات پیچیده و ایده‌پردازی استفاده کنید. هرچه درخواست شما دقیق‌تر و با جزئیات بیشتری باشد، پاسخ بهتری دریافت خواهید کرد. و دراخر میتوانید تمام خواسته های خود را به فایل های اکسل -ورد- پی دی اف تبدیل کنید",
    image:
      "این مدل برای خلق تصاویر از طریق توصیفات متنی ساخته شده است. برای بهترین نتیجه، جزئیات دقیقی از سوژه، پس‌زمینه، استایل هنری (مثلاً نقاشی دیجیتال، عکس واقعی، کارتونی)، نورپردازی و ترکیب‌بندی ارائه دهید.",
    live: "این مدل برای پاسخ‌دهی آنی و مکالمه زنده بهینه‌سازی شده است. هزینه آن بالاتر است و برای کاربردهایی مثل دستیار صوتی زنده یا چت‌بات‌های فوری مناسب است.",
    research:
      "این مدل برای جستجو، تحلیل و خلاصه‌سازی حجم بالایی از اطلاعات و مقالات علمی طراحی شده است. برای استفاده از آن، موضوع تحقیق، بازه زمانی و منابع مورد نظر خود را مشخص کنید.",
    computer:
      "این مدل می‌تواند وظایف کامپیوتری را از طریق دستورات زبان طبیعی انجام دهد. مثلاً می‌توانید از آن بخواهید یک فایل را پیدا کند، ایمیلی را پیش‌نویس کند یا اطلاعاتی را در یک نرم‌افزار وارد کند."
  }

  const examples: { [key: string]: { type: string; prompt: string } } = {
    "gpt-5": {
      type: "general",
      prompt:
        "یک سناریوی کوتاه برای یک فیلم علمی-تخیلی بنویس که در آن انسان‌ها با یک هوش مصنوعی فرازمینی ارتباط برقرار می‌کنند."
    },
    "gpt-4o-mini": {
      type: "general",
      prompt: "یک ایمیل رسمی برای درخواست مرخصی به مدیرم بنویس."
    },
    "dall-e-3": {
      type: "image",
      prompt:
        "یک گربه فضانورد که روی ماه نشسته و به زمین نگاه می‌کند، با استایل نقاشی رنگ روغن کلاسیک."
    },
    "gpt-image-1": {
      type: "image",
      prompt:
        "یک لوگوی مدرن و مینیمال برای یک کافی‌شاپ به نام 'نور'، با استفاده از رنگ‌های طلایی و مشکی."
    },
    "gpt-4o-realtime-preview": {
      type: "live",
      prompt:
        "(در یک مکالمه صوتی) 'آب و هوای تهران فردا چطوره؟' یا 'یک قرار ملاقات برای ساعت ۳ بعد از ظهر تنظیم کن.'"
    },
    "o3-deep-research": {
      type: "research",
      prompt:
        "آخرین دستاوردهای علمی در زمینه باتری‌های حالت جامد از سال ۲۰۲۳ به بعد را خلاصه کن و منابع کلیدی را لیست کن."
    },
    "computer-use-preview": {
      type: "computer",
      prompt:
        "تمام فایل‌های PDF در پوشه 'Downloads' که در نامشان کلمه 'گزارش' وجود دارد را پیدا کن و به پوشه 'گزارش‌های ماهانه' منتقل کن."
    }
  }

  const modelInfo = examples[modelId] || {
    type: "general",
    prompt: " یک پاراگراف در مورد تاریخچه هوش مصنوعی بنویس. و بهم pdf خروجی بده"
  }

  return {
    guidance: commonGuidance[modelInfo.type as keyof typeof commonGuidance],
    example: modelInfo.prompt
  }
}

// =================================================================
// 3. کامپوننت اصلی صفحه
// =================================================================

export default function HelpPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const getIconForModel = (id: string) => {
    if (id.includes("image") || id.includes("dall-e")) return <FaImage />
    if (id.includes("audio") || id.includes("live")) return <FaMicrophone />
    if (id.includes("computer")) return <FaDesktop />
    if (id.includes("research")) return <FaFlask />
    return <FaBookOpen />
  }

  return (
    <>
      <Head>
        <title>راهنمای مدل‌های Rhyno</title>
      </Head>

      <div className="font-vazir relative min-h-screen overflow-y-auto bg-black text-white">
        {/* پس زمینه گرادیانت */}
        <div
          className="absolute inset-0 z-0 opacity-80"
          style={{
            background:
              "radial-gradient(ellipse at top, #111827 0%, transparent 80%)"
          }}
        />

        <div className="container relative z-10 mx-auto p-4 sm:p-6 lg:p-12">
          <motion.div
            className="w-full rounded-3xl bg-gray-900/50 p-6 shadow-2xl backdrop-blur-sm sm:p-10 lg:p-16"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* عنوان */}
            <motion.div
              dir="rtl"
              className="mb-10 text-center"
              variants={itemVariants}
            >
              <h1 className="text-3xl font-extrabold text-blue-400 sm:text-5xl lg:text-6xl">
                راهنمای استفاده از مدل‌ها
              </h1>
              <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">
                در این بخش می‌توانید با قابلیت‌ها و نحوه استفاده از هر مدل آشنا
                شوید. روی نام هر مدل کلیک کنید تا جزئیات نمایش داده شود.
              </p>
            </motion.div>

            {/* لیست آکاردئونی مدل‌ها */}
            <motion.div
              dir="rtl"
              className="mx-auto max-w-4xl space-y-4"
              variants={containerVariants}
            >
              {models.map(model => {
                const { guidance, example } = getModelGuidance(model.id)
                const isSelected = selectedId === model.id

                return (
                  <motion.div
                    key={model.id}
                    className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/60 transition-colors duration-300 hover:border-blue-500"
                    variants={itemVariants}
                  >
                    {/* هدر قابل کلیک */}
                    <div
                      className="flex cursor-pointer items-center justify-between p-5"
                      onClick={() =>
                        setSelectedId(isSelected ? null : model.id)
                      }
                    >
                      <div className="flex items-center space-x-3 rtl:space-x-reverse">
                        <span className="text-xl text-blue-400">
                          {getIconForModel(model.id)}
                        </span>
                        <h3 className="text-lg font-bold text-white">
                          {model.name}
                        </h3>
                      </div>
                      <motion.div
                        animate={{ rotate: isSelected ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <FaChevronDown className="text-gray-400" />
                      </motion.div>
                    </div>

                    {/* محتوای باز شونده */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          className="px-5"
                          variants={contentVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                        >
                          <div className="border-t border-gray-700 pt-4">
                            <p className="mb-4 text-gray-300">
                              {model.توضیحات}
                            </p>

                            {/* ✨ FIX 1: ترتیب کلاس‌های Tailwind اصلاح شد */}
                            <h4 className="text-md mb-2 font-semibold text-green-400">
                              <FaBookOpen className="ml-2 inline" />
                              نحوه استفاده:
                            </h4>

                            <p className="mb-5 text-sm leading-relaxed text-gray-400">
                              {guidance}
                            </p>

                            {/* ✨ FIX 2: ترتیب کلاس‌های Tailwind اصلاح شد */}
                            <h4 className="text-md mb-3 font-semibold text-green-400">
                              <FaPencilAlt className="ml-2 inline" />
                              مثال کاربردی:
                            </h4>

                            <div className="rounded-lg bg-gray-900/70 p-4">
                              {/* ✨ FIX 3: خطای کوتیشن با استفاده از Template Literal حل شد */}
                              <p className="text-sm italic text-gray-300">
                                {`"${example}"`}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  )
}
