// 🎯 مسیر فایل: components/HomePageClient.tsx

"use client"

import {
  motion,
  Variants,
  useMotionValue,
  useSpring,
  useTransform
} from "framer-motion"
import React, {
  memo,
  useState,
  useEffect,
  useRef,
  PropsWithChildren
} from "react"
import Link from "next/link"
import Image from "next/image"
import Lottie from "lottie-react"
import { cn } from "@/lib/utils"

// کامپوننت جدید چت را ایمپورت می‌کنیم
import FreeChat from "@/components/FreeChat"

// انیمیشن‌ها و آیکون‌ها
import roboticsAnimation from "../public/animations/robotics.json"
import {
  FiArrowRight,
  FiZap,
  FiSmile,
  FiImage,
  FiFileText,
  FiBookOpen,
  FiMenu,
  FiX,
  FiPlus,
  FiArrowDown
} from "react-icons/fi"
import { BsCodeSlash } from "react-icons/bs"
import { BiSolidUserVoice } from "react-icons/bi"
import { FaVoicemail, FaCheckCircle } from "react-icons/fa"
import { LuMousePointerClick, LuBrainCircuit } from "react-icons/lu"
import { GoGoal } from "react-icons/go"

// کامپوننت‌های داخلی
import Testimonials from "@/components/Testimonials"
import AnimatedButton from "@/components/AnimatedButton"

// --- کامپوننت پترن متحرک پس‌زمینه ---
const AnimatedGridPattern = memo(() => (
  <div className="pointer-events-none absolute inset-0 z-0">
    <div
      className="absolute size-full bg-[radial-gradient(circle_at_center,rgba(100,116,139,0.1)_0%,rgba(100,116,139,0)_50%)]"
      style={{
        animation: "pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite"
      }}
    />
    <div className="absolute size-full bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
  </div>
))
AnimatedGridPattern.displayName = "AnimatedGridPattern"

// --- کارت‌های تعاملی Bento Grid با حاشیه گرادیان متحرک ---
const BentoCard = ({
  className = "",
  children
}: PropsWithChildren<{ className?: string }>) => {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springConfig = { damping: 20, stiffness: 150 }
  const smoothMouseX = useSpring(mouseX, springConfig)
  const smoothMouseY = useSpring(mouseY, springConfig)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const { left, top } = ref.current.getBoundingClientRect()
    mouseX.set(e.clientX - left)
    mouseY.set(e.clientY - top)
  }

  const backgroundGlow = useTransform(
    [smoothMouseX, smoothMouseY],
    ([x, y]) =>
      `radial-gradient(600px circle at ${x}px ${y}px, rgba(59, 130, 246, 0.15), transparent 80%)`
  )

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn(
        "group relative rounded-2xl border border-white/10 bg-black/20 p-1 backdrop-blur-sm",
        className
      )}
    >
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/50 to-green-500/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative size-full rounded-[15px] bg-gray-950/80 p-6">
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-[15px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: backgroundGlow }}
        />
        <div className="relative z-10 h-full">{children}</div>
      </div>
    </motion.div>
  )
}

const BentoCardContent = ({
  icon,
  title,
  desc
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) => (
  <div>
    <div className="mb-3 text-blue-400">
      {React.cloneElement(icon as React.ReactElement, {
        className:
          "h-7 w-7 transition-transform duration-300 group-hover:scale-110"
      })}
    </div>
    <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
    <p className="text-sm text-gray-400">{desc}</p>
  </div>
)

// --- داده‌های صفحه ---
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
    desc: "پاسخ‌ها را در کسری از ثانیه دریافت کنید و جریان کاری خود را متحول سازید."
  },
  {
    icon: <BsCodeSlash />,
    title: "کدنویسی هوشمند",
    desc: "مدل بهینه‌شده مخصوص کدنویسی با قابلیت درک و تولید کدهای پیچیده."
  },
  {
    icon: <BiSolidUserVoice />,
    title: "تبدیل متن به صدا",
    desc: "متن‌های خود را با کیفیتی استثنایی و صداهای طبیعی به صوت تبدیل کنید."
  },
  {
    icon: <FiFileText />,
    title: "تولید و تحلیل فایل",
    desc: "خروجی‌های دقیق در قالب Excel دریافت و داده‌های موجود در فایل‌ها را تحلیل کنید."
  },
  {
    icon: <FiImage />,
    title: "تولید تصویر خلاقانه",
    desc: "تصاویر خلاقانه و حرفه‌ای را تنها با چند کلمه و در چند ثانیه بسازید.",
    className: "lg:col-span-2"
  },
  {
    icon: <FiSmile />,
    title: "رابط کاربری لذت‌بخش",
    desc: "تجربه‌ای ساده و کاربرپسند که کار با هوش مصنوعی را آسان می‌کند.",
    className: "lg:col-span-2"
  }
]
const processSteps = [
  {
    icon: <LuMousePointerClick size={32} />,
    title: "۱. درخواست خود را وارد کنید",
    desc: "چه تولید متن باشد، چه کد یا تصویر، ایده خود را بنویسید."
  },
  {
    icon: <LuBrainCircuit size={32} />,
    title: "۲. هوش مصنوعی پردازش می‌کند",
    desc: "بهترین مدل‌های AI درخواست شما را در لحظه تحلیل و پردازش می‌کنند."
  },
  {
    icon: <GoGoal size={32} />,
    title: "۳. نتیجه را دریافت کنید",
    desc: "خروجی باکیفیت و دقیق را فورا دریافت و از آن استفاده کنید."
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

// --- کامپوننت‌های کمکی ---
const SectionTitle = memo(
  ({ children, className = "" }: PropsWithChildren<{ className?: string }>) => (
    <h2
      className={cn(
        "mb-12 text-center text-3xl font-bold text-white sm:text-4xl lg:text-5xl",
        className
      )}
    >
      {children}
    </h2>
  )
)
SectionTitle.displayName = "SectionTitle"

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
    <span className="text-xl font-semibold text-white">Rhyno AI</span>
  </Link>
))
HeaderBrand.displayName = "HeaderBrand"

const LogoTicker = memo(() => (
  <div className="relative w-full overflow-hidden py-8 [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]">
    <div className="animate-scroll flex will-change-transform">
      {[...logos, ...logos].map((logo, index) => (
        <span
          key={index}
          className="mx-6 shrink-0 whitespace-nowrap text-lg font-medium text-gray-500 sm:mx-10 md:text-xl"
        >
          {logo}
        </span>
      ))}
    </div>
  </div>
))
LogoTicker.displayName = "LogoTicker"

// --- کامپوننت اصلی ---
export default function HomePageClient() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navLinks = [
    { href: "#features", label: "ویژگی‌ها" },
    { href: "#process", label: "فرآیند کار" },
    { href: "#pricing", label: "تعرفه‌ها" },
    { href: "/about", label: "درباره ما" },
    { href: "/blog", label: "بلاگ" },
    { href: "/contact", label: "تماس با ما" }
  ]

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
      transition: {
        type: "tween",
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  }

  return (
    <div className="font-vazir min-h-screen w-full overflow-x-hidden bg-black text-gray-300">
      <AnimatedGridPattern />
      <div className="relative z-10">
        {/* Header */}
        <motion.header
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5 }}
          className="sticky top-0 z-40 border-b border-white/10 bg-black/30 py-4 backdrop-blur-lg" // z-index to 40
        >
          <nav className="container relative mx-auto flex items-center justify-between px-4">
            <HeaderBrand />
            <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center space-x-8 md:flex rtl:space-x-reverse">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:block">
                <AnimatedButton
                  href="/login"
                  className="flex items-center space-x-1.5 rounded-lg border border-gray-700 bg-white px-4 py-2 text-sm font-bold text-black transition-all hover:bg-gray-200 hover:shadow-lg hover:shadow-white/10 rtl:space-x-reverse"
                >
                  <span>شروع رایگان</span>
                  <FiArrowRight />
                </AnimatedButton>
              </div>
              <div className="md:hidden">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="text-white focus:outline-none"
                  aria-label="Toggle menu"
                >
                  {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
                </button>
              </div>
            </div>
          </nav>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex flex-col items-center space-y-4 px-4 md:hidden"
            >
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="w-full py-2 text-center text-gray-300 transition-colors hover:text-white"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="w-full rounded-lg bg-blue-600 py-2.5 text-center font-bold text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                شروع رایگان
              </Link>
            </motion.div>
          )}
        </motion.header>

        <main className="container mx-auto px-4">
          {/* Hero Section */}
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
                  {word}&nbsp;
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.2 }}
              className="mx-auto max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg"
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
                <AnimatedButton
                  href="#pricing"
                  className="inline-block rounded-lg bg-blue-600 px-8 py-3.5 font-bold text-black shadow-lg shadow-blue-600/20 transition-all hover:scale-110 hover:bg-blue-700 hover:shadow-blue-600/40"
                >
                  شروع قدرتمند
                </AnimatedButton>
              </motion.div>
            </motion.div>
          </section>

          {/* Hero Image / Lottie */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="absolute inset-x-0 -top-10 z-0 h-1/2 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.15)_0%,_transparent_60%)]" />
            <Lottie
              animationData={roboticsAnimation}
              loop
              autoplay
              style={{
                width: "100%",
                maxWidth: 800,
                height: "auto",
                margin: "0 auto"
              }}
            />
          </motion.div>

          {/* Trusted Logos Section */}
          <section className="py-16">
            <p className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-gray-500">
              مورد اعتماد با استفاده از مدل‌های پیشرو
            </p>
            <LogoTicker />
          </section>

          {/* Bento Grid Features Section */}
          <section id="features" className="py-16 md:py-24">
            <SectionTitle>
              چرا <span dir="ltr">Rhyno AI</span> بهترین انتخاب است؟
            </SectionTitle>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, i) => (
                <BentoCard key={i} className={feature.className}>
                  <BentoCardContent {...feature} />
                </BentoCard>
              ))}
            </div>
          </section>

          {/* Process Section */}
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
                    {step.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-400">{step.desc}</p>
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

          {/* Pricing Section */}
          <section id="pricing" className="py-16 text-center md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.7 }}
              className="relative rounded-2xl p-px [animation:rotate_4s_linear_infinite] [background:conic-gradient(from_var(--angle),_theme(colors.green.500/.2),_theme(colors.blue.500/.2)_50%,_theme(colors.green.500/.2))]"
              style={{ "--angle": "0deg" } as React.CSSProperties}
            >
              <div className="relative overflow-hidden rounded-[15px] bg-gray-950 p-8 shadow-2xl md:p-12">
                <div className="absolute -left-20 -top-20 z-0 size-60 rounded-full bg-green-500/10 blur-3xl" />
                <div className="absolute -bottom-20 -right-20 z-0 size-60 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="relative z-10">
                  <h3 className="mb-2 text-3xl font-bold text-white">
                    پلن دسترسی کامل
                  </h3>
                  <p className="mb-10 text-base text-gray-400">
                    فقط به اندازه مصرف پرداخت کنید و به تمام امکانات دسترسی
                    داشته باشید.
                  </p>
                  <ul className="mb-12 grid grid-cols-1 gap-x-8 gap-y-4 text-right sm:grid-cols-2 lg:grid-cols-3">
                    {pricingFeatures.map(item => (
                      <li key={item} className="flex items-center gap-3">
                        <FaCheckCircle className="shrink-0 text-green-400" />
                        <span className="text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <AnimatedButton
                    href="/checkout"
                    className="w-full rounded-lg bg-white px-10 py-4 font-bold text-black transition-transform hover:scale-105 sm:w-auto"
                  >
                    تهیه اشتراک و شروع استفاده
                  </AnimatedButton>
                </div>
              </div>
            </motion.div>
          </section>
        </main>

        {/* ✨ تغییر اصلی: افزایش فاصله پایین فوتر برای موبایل */}
        <footer className="border-t border-white/10 py-8 pb-28 text-center sm:pb-8">
          <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:flex-row">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Rhyno AI. تمامی حقوق محفوظ است.
            </p>
            <div
              dangerouslySetInnerHTML={{
                __html: `<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT' alt='نماد اعتماد الکترونیکی' style='cursor:pointer; width:80px;' code='snXTJxUEZgVAphAqD5lpep29PJRZ2haT'></a>`
              }}
            />
          </div>
        </footer>
      </div>

      {/* ✨ کامپوننت چت اینجا اضافه شد ✨ */}
      <FreeChat />
    </div>
  )
}
