"use client"

import { motion } from "framer-motion"
import { FiZap, FiFeather, FiUsers, FiEye, FiTarget } from "react-icons/fi"

// کامپوننت کارت ارزش‌ها
const ValueCard = ({
  icon,
  title,
  text
}: {
  icon: React.ReactNode
  title: string
  text: string
}) => (
  <motion.div
    className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
    viewport={{ once: true, amount: 0.3 }}
  >
    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-gray-800 text-blue-400">
      {icon}
    </div>
    <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
    <p className="text-gray-400">{text}</p>
  </motion.div>
)

export default function AboutPage() {
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.2 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
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
          variants={containerVariants}
        >
          <motion.h1
            className="mb-4 text-4xl font-extrabold text-white sm:text-5xl md:text-6xl"
            variants={itemVariants}
          >
            آینده را با <span className="text-blue-400">هوش مصنوعی</span> بسازید
          </motion.h1>
          {/* متن جدید و بهبودیافته */}
          <motion.p
            className="mx-auto max-w-3xl text-lg text-gray-400"
            dir="rtl" // اضافه شد
            variants={itemVariants}
          >
            ما آینده‌ای را می‌سازیم که در آن هوش مصنوعی مرزهای خلاقیت و کارایی
            را جابجا می‌کند ماموریت ما در Rhyno AI، تبدیل این چشم‌انداز به
            واقعیت است؛ با ارائه ابزارهایی که قدرت هوش مصنوعی را به سادگی در
            دستان شما قرار می‌دهند
          </motion.p>
        </motion.section>

        {/* بخش داستان ما */}
        <motion.section
          className="py-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
        >
          <div className="mx-auto max-w-4xl text-center">
            <FiTarget className="mx-auto mb-4 size-12 text-blue-400" />
            <h2 className="mb-4 text-3xl font-bold text-white">
              داستان ما، هدف شما
            </h2>
            {/* متن جدید و بهبودیافته */}
            <p
              className="text-base leading-relaxed text-gray-400 md:text-lg"
              dir="rtl" // اضافه شد
            >
              داستان ما از یک سوال ساده شروع شد: چرا ابزارهای پیشرفته هوش مصنوعی
              باید اینقدر پیچیده و دور از دسترس باشند؟ ما تصمیم گرفتیم این
              معادله را تغییر دهیم. Rhyno AI حاصل عشق به نوآوری و ساعت‌ها تلاش
              است؛ پلتفرمی که به عنوان یک پل بین توانایی‌های بی‌نهایت AI و
              نیازهای واقعی شما عمل می‌کند. ما موانع را برمی‌داریم تا شما
              بتوانید بدون دغدغه، روی خلق کردن و حل مسائل تمرکز کنید
            </p>
          </div>
        </motion.section>

        {/* بخش جدید: ارزش‌های ما */}
        <section className="py-16 text-center">
          <h2 className="mb-12 text-3xl font-bold text-white">
            ارزش‌های کلیدی ما
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <ValueCard
              icon={<FiZap size={24} />}
              title="نوآوری بی‌پایان"
              text="ما همواره در جستجوی جدیدترین تکنولوژی‌ها هستیم تا بهترین‌ها را به شما ارائه دهیم"
            />
            <ValueCard
              icon={<FiFeather size={24} />}
              title="سادگی قدرتمند"
              text="ما پیچیده‌ترین فرآیندها را به تجربه‌ای روان و لذت‌بخش برای شما تبدیل می‌کنیم"
            />
            <ValueCard
              icon={<FiUsers size={24} />}
              title="تمرکز بر شما"
              text="شما در مرکز تمام تصمیمات ما قرار دارید. موفقیت شما، بزرگترین دستاورد ماست"
            />
            <ValueCard
              icon={<FiEye size={24} />}
              title="شفافیت کامل"
              text="ما به ارتباط صادقانه و شفافیت در عملکرد، قیمت‌گذاری و پشتیبانی اعتقاد داریم"
            />
          </div>
        </section>
      </main>
    </div>
  )
}
