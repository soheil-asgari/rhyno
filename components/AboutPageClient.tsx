"use client"

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type Variants
} from "framer-motion"
import React, { memo, useRef, PropsWithChildren } from "react"
import { FiZap, FiFeather, FiUsers, FiEye, FiTarget } from "react-icons/fi"
import { cn } from "@/lib/utils" // فرض بر این است که این فایل را ساخته‌اید

// --- ✨ [ارتقا] کامپوننت پترن متحرک پس‌زمینه (برای هماهنگی با صفحه اصلی) ---
const AnimatedGridPattern = memo(() => (
  <div className="pointer-events-none absolute inset-0 z-0">
    <div
      className="absolute size-full bg-[radial-gradient(circle_at_center,rgba(100,116,139,0.1)_0%,rgba(100,116,139,0)_50%)]"
      style={{ animation: "pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}
    />
    <div className="absolute size-full bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
  </div>
))
AnimatedGridPattern.displayName = "AnimatedGridPattern"

// --- ✨ [ارتقا] کامپوننت کارت ارزش‌ها با افکت‌های تعاملی ---
const ValueCard = ({
  icon,
  title,
  text
}: {
  icon: React.ReactNode
  title: string
  text: string
}) => {
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
      `radial-gradient(500px circle at ${x}px ${y}px, rgba(59, 130, 246, 0.1), transparent 80%)`
  )

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="group relative rounded-2xl border border-white/10 bg-black/20 p-1 text-center backdrop-blur-sm"
    >
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-500/50 to-green-500/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative size-full rounded-[15px] bg-gray-950/80 p-6">
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-[15px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: backgroundGlow }}
        />
        <div className="relative z-10 flex h-full flex-col items-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-white/10 bg-gray-900 text-blue-400 transition-all duration-300 group-hover:scale-110 group-hover:border-blue-500/30">
            {icon}
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
          <p className="text-sm text-gray-400">{text}</p>
        </div>
      </div>
    </motion.div>
  )
}

export default function AboutPage() {
  const heroTitle = "آینده را با هوش مصنوعی بسازید"
  const titleWords = heroTitle.split(" ")

  // کد اصلاح شده
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

  return (
    <div className="font-vazir min-h-screen w-full overflow-x-hidden bg-black text-gray-300">
      <AnimatedGridPattern />

      <main className="container relative z-10 mx-auto px-4 py-16 sm:py-24">
        {/* بخش Hero */}
        <section className="text-center">
          <motion.h1
            variants={titleContainerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto mb-6 max-w-4xl text-4xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl"
          >
            {titleWords.map((word, index) => {
              // کلمات "هوش" و "مصنوعی" گرادیانت می‌گیرند
              const isHighlighted = word === "هوش" || word === "مصنوعی"
              return (
                <motion.span
                  key={index}
                  variants={titleWordVariants}
                  className="inline-block"
                >
                  <span
                    className={cn(
                      isHighlighted &&
                        "bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent"
                    )}
                  >
                    {word}
                  </span>
                  &nbsp;
                </motion.span>
              )
            })}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.2 }}
            className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-400"
            dir="rtl"
          >
            ما آینده‌ای را می‌سازیم که در آن هوش مصنوعی مرزهای خلاقیت و کارایی
            را جابجا می‌کند. ماموریت ما در Rhyno AI، تبدیل این چشم‌انداز به
            واقعیت است؛ با ارائه ابزارهایی که قدرت هوش مصنوعی را به سادگی در
            دستان شما قرار می‌دهند.
          </motion.p>
        </section>

        {/* ✨ [ارتقا] بخش داستان ما با چیدمان دو ستونی */}
        <section className="py-24">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-right"
              dir="rtl"
            >
              <h2 className="mb-4 text-3xl font-bold text-white">
                داستان ما، هدف شما
              </h2>
              <p className="text-base leading-relaxed text-gray-400 md:text-lg">
                داستان ما از یک سوال ساده شروع شد: چرا ابزارهای پیشرفته هوش
                مصنوعی باید اینقدر پیچیده و دور از دسترس باشند؟ ما تصمیم گرفتیم
                این معادله را تغییر دهیم. Rhyno AI حاصل عشق به نوآوری و ساعت‌ها
                تلاش است؛ پلتفرمی که به عنوان یک پل بین توانایی‌های بی‌نهایت AI
                و نیازهای واقعی شما عمل می‌کند. ما موانع را برمی‌داریم تا شما
                بتوانید بدون دغدغه، روی خلق کردن و حل مسائل تمرکز کنید.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex h-80 items-center justify-center"
            >
              {/* المان بصری متحرک */}
              <div className="absolute size-full rounded-full bg-gradient-to-r from-blue-500/10 to-green-500/10 [animation:pulse_8s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
              <div className="absolute size-5/6 rounded-full bg-gradient-to-r from-blue-500/10 to-green-500/10 [animation:pulse_6s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
              <FiTarget className="relative z-10 size-16 text-blue-400" />
            </motion.div>
          </div>
        </section>

        {/* بخش ارزش‌های ما */}
        <section className="py-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6 }}
            className="mb-12 text-3xl font-bold text-white"
          >
            ارزش‌های کلیدی ما
          </motion.h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <ValueCard
              icon={<FiZap size={28} />}
              title="نوآوری بی‌پایان"
              text="ما همواره در جستجوی جدیدترین تکنولوژی‌ها هستیم تا بهترین‌ها را به شما ارائه دهیم."
            />
            <ValueCard
              icon={<FiFeather size={28} />}
              title="سادگی قدرتمند"
              text="ما پیچیده‌ترین فرآیندها را به تجربه‌ای روان و لذت‌بخش برای شما تبدیل می‌کنیم."
            />
            <ValueCard
              icon={<FiUsers size={28} />}
              title="تمرکز بر شما"
              text="شما در مرکز تمام تصمیمات ما قرار دارید. موفقیت شما، بزرگترین دستاورد ماست."
            />
            <ValueCard
              icon={<FiEye size={28} />}
              title="شفافیت کامل"
              text="ما به ارتباط صادقانه و شفافیت در عملکرد، قیمت‌گذاری و پشتیبانی اعتقاد داریم."
            />
          </div>
        </section>
      </main>
    </div>
  )
}
