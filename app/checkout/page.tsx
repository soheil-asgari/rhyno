"use client"

import React from "react"
import { motion, Variants } from "framer-motion"
import { modelsWithRial } from "./pricing"
import { FaMicrochip, FaCreditCard } from "react-icons/fa"
import { useIsMobile } from "../../lib/hooks/useIsMobile"
import Head from "next/head"

// تعریف واریانت‌های مختلف برای انیمیشن‌ها
const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1 // فاصله زمانی بین انیمیشن‌ها
    }
  }
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut"
    }
  }
}

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  }
}

export default function CheckoutPage() {
  const isMobile = useIsMobile()

  return (
    <>
      <Head>
        <title>اطلاعات مدل‌های Rhyno</title>
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

        {/* محتوای صفحه با انیمیشن ورود کلی */}
        <div className="container relative z-10 mx-auto p-4 sm:p-6 lg:p-12">
          <motion.div
            className="w-full rounded-3xl bg-gray-900/50 p-6 shadow-2xl backdrop-blur-sm sm:p-10 lg:p-16"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* عنوان اصلی با انیمیشن */}
            <motion.div
              dir="rtl"
              className="mb-12 space-y-6 px-4 text-center sm:px-0"
              variants={itemVariants}
            >
              <h1 className="text-3xl font-extrabold text-blue-400 sm:text-5xl lg:text-6xl">
                اطلاعات مدل های <span className="text-white">Rhyno</span>
              </h1>
              <p className="mx-auto mt-4 max-w-4xl text-base leading-relaxed text-gray-300 sm:text-lg lg:text-xl">
                اینجا می‌توانید اشتراک خود را تکمیل کنید و به تمامی مدل‌های
                پیشرفته ما دسترسی پیدا کنید.
                <br />
                با پلن{" "}
                <span className="font-bold text-green-400">
                  Pay as you go
                </span>{" "}
                فقط زمانی که از مدل‌ها استفاده می‌کنید، هزینه می‌پردازید.
              </p>
            </motion.div>

            {/* توضیحات بلند و اعتمادساز با انیمیشن */}
            <motion.div
              dir="rtl"
              className="mb-10 space-y-6 px-4 text-center sm:px-0"
              variants={itemVariants}
            >
              <h2 className="text-3xl font-extrabold text-blue-400 sm:text-4xl lg:text-5xl">
                چرا <span className="text-white">Pay as you go</span> بهترین
                انتخاب شماست؟
              </h2>
              <p className="mx-auto max-w-4xl text-base leading-relaxed text-gray-300 sm:text-lg lg:text-xl">
                با این پلن شما فقط هزینه‌ای که واقعاً استفاده می‌کنید را پرداخت
                می‌کنید. دیگر نیازی نیست برای دسترسی به همه مدل‌ها مبلغ هنگفت
                بدهید یا نگران هدر رفتن پولتان باشید.
                <br />
                <br />
                تیم ما پلتفرم را با تمرکز روی راحتی شما ساخته است. بدون فیلترشکن
                و با اتصال مستقیم، به تمام مدل‌ها دسترسی دارید. همه چیز سریع،
                امن و قابل اعتماد است.
                <br />
                <br />
                امنیت داده‌ها اولویت اصلی ماست؛ هیچ کس جز شما به داده‌هایتان
                دسترسی ندارد. تمام ارتباطات شما با رمزنگاری پیشرفته محافظت
                می‌شود و داده‌هایتان در سرورهای امن ایرانی نگهداری می‌شود.
                <br />
                <br />
                تجربه هوش مصنوعی باید ساده و منعطف باشد. هر مدلی که نیاز دارید
                را انتخاب، امتحان و در هر مرحله تصمیم بگیرید چقدر هزینه کنید.
                شما کنترل کامل بودجه‌تان را دارید و می‌توانید در هر لحظه مصرف
                خود را بررسی کنید.
                <br />
                <br />
                به عنوان بخشی از جامعه بزرگ کاربران ایرانی، از آپدیت‌های منظم،
                بهبودهای مداوم و پشتیبانی ۲۴ ساعته بهره‌مند می‌شوید.
                <br />
                <br />
                تیم ما همیشه همراه شماست تا تجربه‌ای بدون مشکل و لذت‌بخش داشته
                باشید. هدف ما ارائه هوش مصنوعی در دسترس، شفاف و با بیشترین
                اعتماد است. ما متعهد هستیم که بهترین کیفیت خدمات را با
                منصفانه‌ترین قیمت‌ها به شما ارائه دهیم.
                <br />
                <br />
                <span className="font-semibold text-blue-400">
                  هزاران کاربر ایرانی قبل از شما این تصمیم هوشمندانه را
                  گرفته‌اند.
                </span>{" "}
                از مدل‌های پیشرفته OpenAI تا Claude و Gemini، همه را در یک مکان
                تجربه کنید.
                <br />
                <br />
                شروع کنید، تست کنید و ببینید چقدر می‌توانید صرفه‌جویی کنید. با
                پلن Pay as you go، هر تومان شما ارزش واقعی دارد و هدر نمی‌شود.
              </p>
            </motion.div>

            {/* بخش مزایای اضافی با انیمیشن */}
            <motion.div
              dir="rtl"
              className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
              variants={containerVariants}
            >
              <motion.div
                className="rounded-lg border border-gray-700 bg-gray-800/50 p-6"
                variants={cardVariants}
              >
                <div className="mb-3 text-2xl text-blue-400">💰</div>
                <h3 className="mb-2 text-xl font-bold text-white">
                  صرفه‌جویی واقعی
                </h3>
                <p className="text-sm text-gray-300">
                  تا ۷۰٪ نسبت به پلن‌های ثابت صرفه‌جویی کنید. فقط آنچه استفاده
                  می‌کنید بپردازید.
                </p>
              </motion.div>

              <motion.div
                className="rounded-lg border border-gray-700 bg-gray-800/50 p-6"
                variants={cardVariants}
              >
                <div className="mb-3 text-2xl text-blue-400">🚀</div>
                <h3 className="mb-2 text-xl font-bold text-white">
                  دسترسی فوری
                </h3>
                <p className="text-sm text-gray-300">
                  شروع فوری بدون هیچ تعهد ماهانه. هر زمان که بخواهید استفاده
                  کنید، هر زمان که بخواهید متوقف کنید.
                </p>
              </motion.div>

              <motion.div
                className="rounded-lg border border-gray-700 bg-gray-800/50 p-6"
                variants={cardVariants}
              >
                <div className="mb-3 text-2xl text-blue-400">🔄</div>
                <h3 className="mb-2 text-xl font-bold text-white">
                  انعطاف کامل
                </h3>
                <p className="text-sm text-gray-300">
                  امروز GPT-4، فردا Claude، پس‌فردا Gemini. بر اساس نیازتان هر
                  مدلی را انتخاب کنید.
                </p>
              </motion.div>
            </motion.div>

            {/* بخش آمار و اعتماد با انیمیشن */}
            <motion.div
              dir="rtl"
              className="mb-10 rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-8"
              variants={itemVariants}
            >
              <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
                <div>
                  <div className="text-3xl font-bold text-blue-400">
                    +۱۰,۰۰۰
                  </div>
                  <div className="text-sm text-gray-300">کاربر فعال</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-400">۹۹.۹٪</div>
                  <div className="text-sm text-gray-300">آپتایم سرویس</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-400">24+</div>
                  <div className="text-sm text-gray-300">مدل هوش مصنوعی</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-blue-400">۲۴/۷</div>
                  <div className="text-sm text-gray-300">پشتیبانی</div>
                </div>
              </div>
            </motion.div>

            {/* بخش تضمین و اعتماد با انیمیشن */}
            <motion.div
              dir="rtl"
              className="mb-4 rounded-lg border border-gray-600 bg-gray-800/30 p-6 text-center"
              variants={itemVariants}
            >
              <h3 className="mb-4 text-2xl font-bold text-white">
                🛡️ تضمین رضایت ۱۰۰٪
              </h3>
              <p className="leading-relaxed text-gray-300">
                اگر در ۷ روز اول راضی نبودید، کل مبلغ شارژ شده‌تان را
                بازمی‌گردانیم.
                <br />
                ما به کیفیت خدماتمان اطمینان کامل داریم و می‌دانیم شما هم راضی
                خواهید بود.
              </p>
            </motion.div>

            {/* عنوان تعرفه مدل‌ها با انیمیشن */}
            <motion.h2
              className="mb-6 text-center text-2xl font-bold text-white sm:text-3xl"
              variants={itemVariants}
            >
              تعرفه مدل‌های پیشرفته
            </motion.h2>

            {/* لیست مدل‌ها با انیمیشن */}
            {modelsWithRial && modelsWithRial.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
                variants={containerVariants}
              >
                {modelsWithRial.map((model, index) => (
                  <motion.div
                    key={model.id}
                    className="group rounded-2xl border border-gray-700 bg-gray-800/60 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-blue-500 hover:bg-gray-800"
                    variants={cardVariants}
                  >
                    <div className="mb-3 flex items-center justify-center space-x-3 rtl:space-x-reverse">
                      <span
                        className={`text-2xl text-blue-400 ${!isMobile ? "group-hover:animate-pulse" : ""}`}
                      >
                        <FaMicrochip />
                      </span>
                      <h3 className="text-xl font-bold text-white">
                        {model.name}
                      </h3>
                    </div>
                    <p className="mb-4 text-center text-sm leading-relaxed text-gray-400">
                      {model.توضیحات}
                    </p>
                    <div className="flex items-center justify-between border-t border-gray-700 pt-4">
                      <span className="text-sm text-gray-400">
                        هزینه برای یک خط ۱۵۰۰ کلمه‌ای:
                      </span>
                      <span className="text-xl font-extrabold text-green-400">
                        {model.costExampleRial?.toLocaleString()} ریال
                      </span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                className="py-8 text-center text-gray-400"
                variants={itemVariants}
              >
                <p>در حال بارگذاری مدل‌ها...</p>
              </motion.div>
            )}

            {/* دکمه پرداخت و ورود با انیمیشن */}
            <motion.div
              className="mt-12 flex flex-col items-center space-y-4"
              variants={itemVariants}
            >
              <a
                href="/login"
                className="flex w-full items-center justify-center rounded-full bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all duration-300 hover:bg-blue-500 md:w-auto"
              >
                <FaCreditCard className="ml-2 inline-block text-xl" />  ورود به
                حساب کاربری و دریافت شارژ هدیه
              </a>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </>
  )
}
