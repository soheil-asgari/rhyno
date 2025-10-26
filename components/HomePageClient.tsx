// HomePageClient.tsx
"use client"

import {
  motion,
  Variants,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence
} from "framer-motion"
import React, {
  memo,
  useState,
  useEffect,
  useRef,
  PropsWithChildren
} from "react"
// ❌ دیگر نیازی به Link, Image, FiMenu, FiX در اینجا نیست (در Header.tsx هستند)
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import { LogoTicker } from "@/components/LogoTicker"
// ✅ ۱. وارد کردن کامپوننت‌های بهینه‌سازی شده

import { AnimatedGridPattern } from "@/components/AnimatedGridPattern"
import { BentoCard, BentoCardContent } from "@/components/BentoCard"
import { SectionTitle } from "@/components/SectionTitle"
import { StarryBackground } from "@/components/StarryBackground"
// ✅ (این import ها مشکلی ندارند)
const FreeChat = dynamic(() => import("@/components/FreeChat"), { ssr: false })
const Testimonials = dynamic(() => import("@/components/Testimonials"))
import Header, { type NavLink } from "@/components/Header"

import {
  FiArrowRight, // (برای دکمه "شروع قدرتمند" لازم است)
  FiZap,
  FiSmile,
  FiImage,
  FiFileText
} from "react-icons/fi"
import { BsCodeSlash } from "react-icons/bs"
import { BiSolidUserVoice } from "react-icons/bi"
import { FaCheckCircle } from "react-icons/fa"
import { LuMousePointerClick, LuBrainCircuit } from "react-icons/lu"
import { GoGoal } from "react-icons/go"
import AnimatedButton from "@/components/AnimatedButton"
import FaqSection from "@/components/FaqSection"
// ❌ ThemeToggleButton هم در Header.tsx است

// ❌ ۲. تمام تعاریف کامپوننت‌های محلی از اینجا حذف شدند
// ❌ const AnimatedGridPattern = ...
// ❌ const BentoCard = ...
// ❌ const BentoCardContent = ...
// ❌ const SectionTitle = ...
// ❌ const HeaderBrand = ...

// --- Page Data (این بخش‌ها مشکلی ندارند) ---
const logos = [
  "OpenAI",
  "Google AI",
  "Anthropic",
  "Grok",
  "Midjourney",
  "Perplexity",
  "Eleven Labs"
]
const features = [
  {
    icon: <FiZap />,
    title: "سرعت بی‌نظیر",
    desc: "پاسخ‌ها را در کسری از ثانیه دریافت کنید..."
  },
  {
    icon: <BsCodeSlash />,
    title: "کدنویسی هوشمند",
    desc: "مدل بهینه‌شده مخصوص کدنویسی..."
  },
  {
    icon: <BiSolidUserVoice />,
    title: "تبدیل متن به صدا",
    desc: "متن‌های خود را با کیفیتی استثنایی..."
  },
  {
    icon: <FiFileText />,
    title: "تولید و تحلیل فایل",
    desc: "خروجی‌های دقیق در قالب Excel..."
  },
  {
    icon: <FiImage />,
    title: "تولید تصویر خلاقانه",
    desc: "تصاویر خلاقانه و حرفه‌ای را...",
    className: "lg:col-span-2"
  },
  {
    icon: <FiSmile />,
    title: "رابط کاربری لذت‌بخش",
    desc: "تجربه‌ای ساده و کاربرپسند...",
    className: "lg:col-span-2"
  }
]
const processSteps = [
  {
    icon: <LuMousePointerClick size={32} />,
    title: "۱. درخواست خود را وارد کنید",
    desc: "چه تولید متن باشد، چه کد یا تصویر..."
  },
  {
    icon: <LuBrainCircuit size={32} />,
    title: "۲. هوش مصنوعی پردازش می‌کند",
    desc: "بهترین مدل‌های AI درخواست شما را در لحظه..."
  },
  {
    icon: <GoGoal size={32} />,
    title: "۳. نتیجه را دریافت کنید",
    desc: "خروجی باکیفیت و دقیق را فورا دریافت..."
  }
]
const pricingFeatures = [
  "دسترسی به تمام مدل‌های AI",
  "پشتیبانی ۲۴/۷",
  "تولید نامحدود محتوا",
  "API اختصاصی",
  "تحلیل فایل و اسناد",
  "مدل‌های Realtime"
]

// --- Main Component ---
export default function HomePageClient() {
  const companyNavLinks: NavLink[] = [
    { href: "#features", label: "ویژگی‌ها" },
    { href: "#process", label: "فرآیند کار" },
    { href: "#pricing", label: "تعرفه‌ها" },
    { href: "/about", label: "درباره ما" },
    { href: "/blog", label: "بلاگ" },
    { href: "/contact", label: "تماس با ما" },
    { href: "#faq", label: "سوالات متداول" },
    { href: "/company", label: "شرکت" }
  ]
  // ❌ ۳. این state دیگر نیاز نیست (در Header.tsx است)
  // const [isMenuOpen, setIsMenuOpen] = useState(false)

  // (این state برای Lottie لازم است)
  type AnimationData = object | null
  const [animationData, setAnimationData] = useState<AnimationData>(null)

  useEffect(() => {
    fetch("/animations/robotics.json")
      .then(res => res.json())
      .then(data => setAnimationData(data))
      .catch(err => console.error("Failed to load animation", err))
  }, [])

  // ❌ ۴. این آرایه دیگر نیاز نیست (در Header.tsx است)
  // const navLinks = [ ... ]

  const heroTitle = "مرکز فرماندهی هوش مصنوعی شما"
  const titleWords = heroTitle.split(" ")
  const titleContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.2 }
    }
  }
  const titleWordVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "tween", duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    }
  }

  // --- کامپوننت MultiModalHero ---
  // ✅ ۵. رنگ‌های داخل این کامپوننت محلی اصلاح شد
  const MultiModalHero = () => {
    const [showPrompt, setShowPrompt] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [showOutputs, setShowOutputs] = useState(false)

    const promptText = '"یه ایده خوب برای ساخت محتوا بده"'

    const outputCards = [
      {
        icon: <FiFileText />,
        title: "ایده مقاله",
        desc: "ساختار یک مقاله بلاگ جذاب..."
      },
      {
        icon: <FiImage />,
        title: "تصویر پیشنهادی",
        desc: "یک تصویر هنری مینیمال..."
      },
      {
        icon: <BsCodeSlash />,
        title: "اسکریپت کوتاه",
        desc: "اسکریپت پایتون برای پیدا کردن..."
      },
      {
        icon: <BiSolidUserVoice />,
        title: "اسکریپت پادکست",
        desc: "متن یک پادکست کوتاه ۵ دقیقه‌ای..."
      }
    ]

    useEffect(() => {
      const timer1 = setTimeout(() => setShowPrompt(true), 500)
      const timer2 = setTimeout(() => setIsProcessing(true), 1700)
      const timer3 = setTimeout(() => {
        setIsProcessing(false)
        setShowOutputs(true)
      }, 3500)
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }, [])

    const gridVariants: Variants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: 0.2, delayChildren: 0.1 }
      }
    }

    const cardVariants: Variants = {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 100 }
      }
    }

    return (
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-6 py-8">
        {/* ۱. کارت پرامپت */}

        <AnimatePresence>
          {showPrompt && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              // ✅ FIX: اصلاح رنگ پس‌زمینه
              className="w-full max-w-lg rounded-2xl border border-blue-500/30 bg-white p-5 text-center shadow-xl shadow-blue-500/10 backdrop-blur-md transition-colors duration-300 dark:bg-gray-950/80"
            >
              {/* ✅ FIX: اصلاح رنگ متن */}
              <p className="text-lg text-gray-700 transition-colors duration-300 dark:text-gray-300">
                {promptText}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ۲. نشانگر پردازش (مشکلی ندارد) */}
        <div className="my-4 h-12">
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: { type: "spring" }
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="flex flex-col items-center gap-2"
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <LuBrainCircuit size={32} className="text-blue-400" />
                </motion.div>
                <p className="text-sm text-blue-400">در حال پردازش...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ۳. گرید خروجی‌ها */}
        <AnimatePresence>
          {showOutputs && (
            <motion.div
              variants={gridVariants}
              initial="hidden"
              animate="visible"
              className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4"
            >
              {outputCards.map((card, i) => (
                <motion.div key={i} variants={cardVariants}>
                  {/* این کامپوننت اکنون از نسخه import شده و بهینه‌سازی شده استفاده می‌کند */}
                  <BentoCard className="h-full">
                    <BentoCardContent
                      icon={card.icon}
                      title={card.title}
                      desc={card.desc}
                    />
                  </BentoCard>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // --- رندر نهایی ---
  return (
    <div className="font-vazir min-h-screen w-full overflow-x-hidden bg-white text-gray-800 transition-colors duration-300 dark:bg-black dark:text-gray-300">
      <AnimatedGridPattern />
      <StarryBackground />
      <div className="relative z-10">
        {/* ✅ ۶. جایگزینی هدر قدیمی با کامپوننت جدید */}
        <Header navLinks={companyNavLinks} />

        {/* ❌ ۷. کل بلاک <motion.header> ... </motion.header> از اینجا حذف شد */}

        <main className="container mx-auto px-4">
          {/* --- بخش Hero --- */}
          <section className="py-20 text-center md:py-32">
            <motion.h1
              variants={titleContainerVariants}
              initial="hidden"
              animate="visible"
              className="mb-6 bg-gradient-to-br from-blue-400 via-green-400 to-blue-500 bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-5xl md:text-6xl lg:text-7xl"
            >
              {titleWords.map((word, index) => (
                <motion.span
                  key={index}
                  variants={titleWordVariants}
                  className="inline-block"
                >
                  {" "}
                  {word}&nbsp;{" "}
                </motion.span>
              ))}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.2 }}
              // ✅ ۸. اصلاح رنگ متن زیرعنوان
              className="mx-auto max-w-2xl text-base leading-relaxed text-gray-700 transition-colors duration-300 sm:text-lg dark:text-gray-400"
              dir="rtl"
            >
              تمام مدل‌های قدرتمند AI در دستان شما، سریع و بدون پیچیدگی. خلاقیت
              خود را آزاد کنید و بهره‌وری را به سطح جدیدی برسانید.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.4 }}
              className="mt-10"
            >
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {/* (این دکمه مشکلی ندارد) */}
                <AnimatedButton
                  href="#pricing"
                  className="inline-block rounded-lg bg-blue-600 px-8 py-3.5 font-bold text-black shadow-lg shadow-blue-600/20 transition-all hover:scale-110 hover:bg-blue-700 hover:shadow-blue-600/40"
                >
                  {" "}
                  شروع قدرتمند{" "}
                </AnimatedButton>
              </motion.div>
            </motion.div>
          </section>

          {/* --- بخش MultiModalHero --- */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative mb-20"
          >
            {/* ✅ ۹. اصلاح opacity نور پس‌زمینه */}
            <div className="absolute inset-x-0 -top-10 z-0 h-1/2 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.15)_0%,_transparent_60%)] opacity-30 transition-opacity duration-300 dark:opacity-100" />
            <MultiModalHero />
          </motion.div>

          {/* --- بخش LogoTicker --- */}
          <section className="py-16">
            {/* ✅ ۱۰. اصلاح رنگ متن */}
            <p className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-gray-600 transition-colors duration-300 dark:text-gray-500">
              {" "}
              مورد اعتماد با استفاده از مدل‌های پیشرو{" "}
            </p>
            <LogoTicker />
          </section>

          {/* --- بخش Features --- */}
          <section id="features" className="py-16 md:py-24">
            <SectionTitle>
              {" "}
              چرا <span dir="ltr">Rhyno AI</span> بهترین انتخاب است؟{" "}
            </SectionTitle>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, i) => (
                <BentoCard key={i} className={feature.className}>
                  {" "}
                  <BentoCardContent {...feature} />{" "}
                </BentoCard>
              ))}
            </div>
          </section>

          {/* --- بخش Process --- */}
          <section id="process" className="py-16 md:py-24">
            <SectionTitle>سادگی در سه مرحله</SectionTitle>
            <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-3">
              {processSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5, delay: i * 0.2 }}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                    {" "}
                    {step.icon}{" "}
                  </div>
                  {/* ✅ ۱۱. اصلاح رنگ متن */}
                  <h3 className="mb-2 text-lg font-semibold text-black transition-colors duration-300 dark:text-white">
                    {" "}
                    {step.title}{" "}
                  </h3>
                  {/* ✅ ۱۲. اصلاح رنگ متن */}
                  <p className="text-sm text-gray-700 transition-colors duration-300 dark:text-gray-400">
                    {step.desc}
                  </p>
                  {i < processSteps.length - 1 && (
                    <div className="absolute left-1/2 top-8 hidden h-full w-[calc(100%+2rem)] -translate-y-px translate-x-1/2 items-center md:flex">
                      <div className="h-px w-full bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>

          <Testimonials />

          {/* --- بخش Pricing --- */}
          <section id="pricing" className="py-16 text-center md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7 }}
              className="relative rounded-2xl p-px [animation:rotate_4s_linear_infinite] [background:conic-gradient(from_var(--angle),_theme(colors.green.500/.2),_theme(colors.blue.500/.2)_50%,_theme(colors.green.500/.2))]"
              style={{ "--angle": "0deg" } as React.CSSProperties}
            >
              {/* ✅ ۱۳. اصلاح رنگ پس‌زمینه */}
              <div className="relative overflow-hidden rounded-[15px] bg-gray-50 p-8 shadow-2xl transition-colors duration-300 md:p-12 dark:bg-gray-950">
                <div className="absolute -left-20 -top-20 z-0 size-60 rounded-full bg-green-500/10 opacity-30 blur-3xl dark:opacity-100" />
                <div className="absolute -bottom-20 -right-20 z-0 size-60 rounded-full bg-blue-500/10 opacity-30 blur-3xl dark:opacity-100" />
                <div className="relative z-10">
                  {/* ✅ ۱۴. اصلاح رنگ متن */}
                  <h3 className="mb-2 text-3xl font-bold text-black transition-colors duration-300 dark:text-white">
                    {" "}
                    پلن دسترسی کامل{" "}
                  </h3>
                  {/* ✅ ۱۵. اصلاح رنگ متن */}
                  <p className="mb-10 text-base text-gray-700 transition-colors duration-300 dark:text-gray-400">
                    {" "}
                    فقط به اندازه مصرف پرداخت کنید و به تمام امکانات دسترسی
                    داشته باشید.{" "}
                  </p>
                  <ul className="mb-12 grid grid-cols-1 gap-x-8 gap-y-4 text-right sm:grid-cols-2 lg:grid-cols-3">
                    {pricingFeatures.map(item => (
                      <li key={item} className="flex items-center gap-3">
                        {" "}
                        <FaCheckCircle className="shrink-0 text-green-400" />
                        {/* ✅ ۱۶. اصلاح رنگ متن */}
                        <span className="text-gray-800 transition-colors duration-300 dark:text-gray-300">
                          {item}
                        </span>{" "}
                      </li>
                    ))}
                  </ul>
                  {/* (این دکمه مشکلی ندارد) */}
                  <AnimatedButton
                    href="/checkout"
                    className="w-full rounded-lg bg-white px-10 py-4 font-bold text-black transition-transform hover:scale-105 sm:w-auto"
                  >
                    {" "}
                    تهیه اشتراک و شروع استفاده{" "}
                  </AnimatedButton>
                </div>
              </div>
            </motion.div>
          </section>

          <FaqSection />
        </main>

        {/* --- بخش Footer --- */}
        {/* ✅ ۱۷. اصلاح رنگ‌های فوتر */}
        <footer className="border-t border-black/10 py-8 pb-28 text-center transition-colors duration-300 sm:pb-8 dark:border-white/10">
          <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:flex-row">
            <p className="text-sm text-gray-600 transition-colors duration-300 dark:text-gray-500">
              {" "}
              &copy; {new Date().getFullYear()} Rhyno AI. تمامی حقوق محفوظ
              است.{" "}
            </p>
            <div
              dangerouslySetInnerHTML={{
                __html: `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT' alt='نماد اعتماد الکترونیکی' style='cursor:pointer; width:80px;' code='snXTJxUEZgVAphAqD5lpep29PJRZ2haT'></a>`
              }}
            />
          </div>
        </footer>
      </div>
      <FreeChat />
    </div>
  )
}
