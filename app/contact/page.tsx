"use client"

import { motion } from "framer-motion"
import { FiMail, FiMessageSquare, FiSend } from "react-icons/fi"
import { useState, FormEvent } from "react"

export default function ContactPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState("") // برای پیام‌های وضعیت

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus("در حال ارسال...")

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message })
      })

      if (response.ok) {
        setStatus("پیام شما با موفقیت ارسال شد! ✅")
        setName("")
        setEmail("")
        setMessage("")
      } else {
        throw new Error("خطا در ارسال پیام.")
      }
    } catch (error) {
      setStatus("مشکلی پیش آمد. لطفا دوباره تلاش کنید ❌")
      console.error(error)
    }
  }

  return (
    <div className="font-vazir min-h-screen w-full overflow-x-hidden bg-gray-950 text-gray-300">
      <div
        className="absolute inset-x-0 top-0 h-[500px] w-full"
        style={{
          background:
            "radial-gradient(ellipse at top, #111827, transparent 80%)"
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
            className="mb-4 text-4xl font-extrabold text-white sm:text-5xl md:text-6xl"
            variants={itemVariants}
          >
            تماس با ما
          </motion.h1>
          <motion.p
            className="mx-auto max-w-2xl text-lg text-gray-400"
            variants={itemVariants}
          >
            سوالی دارید یا آماده همکاری هستید؟ ما همیشه برای گفتگو آماده‌ایم
          </motion.p>
        </motion.section>

        {/* بخش فرم و اطلاعات تماس */}
        <motion.section
          className="mx-auto mt-16 max-w-4xl"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
        >
          <div className="grid grid-cols-1 gap-12 rounded-2xl border border-gray-800 bg-gray-900 p-8 md:grid-cols-2 md:p-12">
            {/* اطلاعات تماس */}
            <div className="flex flex-col justify-center space-y-6">
              <div>
                <FiMail className="mb-2 size-6 text-blue-400" />
                <h3 className="text-xl font-semibold text-white">ایمیل</h3>
                <p className="text-gray-400">برای سوالات عمومی و پشتیبانی</p>
                <a
                  href="mailto:info@rhynoai.ir"
                  className="text-blue-400 hover:underline"
                >
                  info@rhynoai.ir
                </a>
              </div>
              <div>
                <FiMessageSquare className="mb-2 size-6 text-blue-400" />
                <h3 className="text-xl font-semibold text-white">
                  شبکه‌های اجتماعی
                </h3>
                <p className="text-gray-400">
                  ما را دنبال کنید و در ارتباط باشید
                </p>
                <a href="#" className="text-blue-400 hover:underline">
                  تلگرام | لینکدین
                </a>
              </div>
            </div>

            {/* فرم تماس */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="name"
                  className="mb-1 block text-sm font-medium text-gray-400"
                >
                  نام شما
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="نام کامل"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-400"
                >
                  ایمیل
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="mb-1 block text-sm font-medium text-gray-400"
                >
                  پیام شما
                </label>
                <textarea
                  id="message"
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="پیام خود را اینجا بنویسید..."
                ></textarea>
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white transition-transform hover:scale-105 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={status === "در حال ارسال..."}
              >
                <FiSend />
                <span>ارسال پیام</span>
              </button>
              {status && (
                <p className="mt-4 text-center text-sm text-gray-400">
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
