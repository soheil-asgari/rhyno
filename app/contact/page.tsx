"use client"

import { motion } from "framer-motion"
import {
  FiMail,
  FiSend,
  FiPhone,
  FiSmartphone,
  FiArrowLeft
} from "react-icons/fi"
import { FaWhatsapp, FaTelegramPlane } from "react-icons/fa" // آیکون‌های واتس‌اپ و تلگرام
import { useState, FormEvent } from "react"
import { StarryBackground } from "@/components/StarryBackground" // ایمپورت پس‌زمینه ستاره‌ای

export default function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState("") // برای پیام‌های وضعیت

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }

  // اطلاعات تماس جدید
  const contactMethods = [
    {
      icon: <FiPhone className="size-6 text-blue-500" />,
      title: "تلفن ثابت (واحد فروش)",
      desc: "شنبه تا چهارشنبه، ۹ صبح تا ۵ عصر",
      value: "021-77439141", // شماره تلفن خود را جایگزین کنید
      href: "tel:+982177439141" // شماره تلفن خود را جایگزین کنید
    },
    {
      icon: <FiSmartphone className="size-6 text-blue-500" />,
      title: "موبایل (پشتیبانی فنی)",
      desc: "تماس مستقیم در ساعات اداری",
      value: "0919-5920275", // شماره موبایل خود را جایگزین کنید
      href: "tel:+989195920275" // شماره موبایل خود را جایگزین کنید
    },
    {
      icon: <FaWhatsapp className="size-6 text-green-500" />,
      title: "واتس‌اپ (مشاوره)",
      desc: "پاسخگویی سریع برای سوالات پیش از خرید",
      value: "0998-1371524", // شماره واتس‌اپ خود را جایگزین کنید
      href: "https://wa.me/989121234567" // لینک واتس‌اپ خود را جایگزین کنید
    },
    {
      icon: <FaTelegramPlane className="size-6 text-sky-500" />,
      title: "تلگرام (پشتیبانی)",
      desc: "ارتباط مستقیم با تیم فنی",
      value: "@Rhynoai", // آیدی تلگرام خود را جایگزین کنید
      href: "https://t.me/Rhynoai" // لینک تلگرام خود را جایگزین کنید
    },
    {
      icon: <FiMail className="size-6 text-red-500" />,
      title: "ایمیل (امور سازمانی)",
      desc: "ارسال مستندات و پیشنهادات رسمی",
      value: "info@rhynoai.ir",
      href: "mailto:info@rhynoai.ir"
    }
  ]

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus("در حال ارسال...")

    try {
      // اینجا منطق ارسال فرم به API شما قرار می‌گیرد
      // مثال:
      // const response = await fetch("/api/contact", { ... });
      // if (response.ok) { ... }

      // شبیه‌سازی موفقیت‌آمیز بودن
      await new Promise(resolve => setTimeout(resolve, 1500))

      setStatus("پیام شما با موفقیت ارسال شد! ✅")
      setName("")
      setEmail("")
      setMessage("")

      // شبیه‌سازی خطا
      // throw new Error("خطا در ارسال پیام.");
    } catch (error) {
      setStatus("مشکلی پیش آمد. لطفا دوباره تلاش کنید ❌")
      console.error(error)
    }
  }

  return (
    // سازگاری با تم روشن و تاریک
    <div className="font-vazir relative min-h-screen w-full overflow-x-hidden bg-white text-gray-900 dark:bg-[#0f1018] dark:text-gray-300">
      {/* پس‌زمینه ستاره‌ای */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarryBackground />
      </div>

      {/* گرادینت پس‌زمینه هیرو */}
      <div
        className="absolute inset-x-0 top-0 z-0 h-[500px] w-full"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(19, 78, 171, 0.1), transparent 80%)"
        }}
      />

      <main className="container relative z-10 mx-auto px-4 py-16 sm:py-24">
        {/* بخش Hero */}
        <motion.section
          className="text-center"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.2 } }
          }}
        >
          <motion.h1
            className="mb-4 text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl dark:text-white"
            variants={itemVariants}
          >
            تماس با ما
          </motion.h1>
          <motion.p
            className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400"
            variants={itemVariants}
          >
            سوالی دارید یا آماده همکاری هستید؟ ما همیشه برای گفتگو آماده‌ایم. از
            طریق فرم یا راه‌های ارتباطی مستقیم با ما در تماس باشید.
          </motion.p>
        </motion.section>

        {/* بخش فرم و اطلاعات تماس */}
        <motion.section
          className="mx-auto mt-16 max-w-6xl" // افزایش عرض برای جای‌گیری بهتر
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.8 }}
        >
          <div className="grid grid-cols-1 gap-12 rounded-2xl border border-black/10 bg-white/50 p-8 shadow-xl backdrop-blur-lg md:grid-cols-5 md:p-12 dark:border-white/10 dark:bg-gray-900/50">
            {/* اطلاعات تماس (بخش جدید و بزرگتر) */}
            <div
              className="flex flex-col justify-start space-y-8 md:col-span-2"
              dir="rtl"
            >
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                راه‌های ارتباطی مستقیم
              </h2>
              {contactMethods.map((method, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="shrink-0 pt-1">{method.icon}</div>
                  <div className="text-right">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {method.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {method.desc}
                    </p>
                    <a
                      href={method.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-lg font-medium text-blue-600 hover:underline dark:text-blue-400"
                      dir="ltr" // برای نمایش صحیح اعداد و آیدی‌ها
                    >
                      {method.value}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* فرم تماس (کمی فشرده‌تر) */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 md:col-span-3"
              dir="rtl"
            >
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-400"
                >
                  نام شما
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                  placeholder="نام کامل"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-400"
                >
                  ایمیل
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-400"
                >
                  پیام شما
                </label>
                <textarea
                  id="message"
                  rows={5}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                  placeholder="پیام خود را اینجا بنویسید..."
                  required
                ></textarea>
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-900"
                disabled={status === "در حال ارسال..."}
              >
                <FiSend />
                <span>
                  {status === "در حال ارسال..."
                    ? "در حال ارسال..."
                    : "ارسال پیام"}
                </span>
              </button>
              {status && (
                <p
                  className={`mt-4 text-center text-sm ${status.includes("❌") ? "text-red-500" : "text-green-500"}`}
                >
                  {status}
                </p>
              )}
            </form>
          </div>
        </motion.section>
      </main>
    </div>
  )
}
