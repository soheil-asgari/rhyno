// 🎯 مسیر فایل: components/Testimonials.tsx

"use client"

import React from "react"

import Image from "next/image"
import { FiStar } from "react-icons/fi"
import { motion, Variants } from "framer-motion"
import { easeOut } from "framer-motion"

// داده‌های نمونه برای نظرات کاربران
const testimonialsData = [
  {
    name: "علی رضایی",
    title: "توسعه‌دهنده وب",
    avatar: "/avatars/avatar-2.png",
    rating: 5,
    comment:
      "به عنوان یک برنامه‌نویس، قابلیت کدنویسی هوشمند Rhyno AI فوق‌العاده‌ست. برای دیباگ کردن و نوشتن کدهای پیچیده ساعت‌ها در وقتم صرفه‌جویی کرده. API تمیز و مستندات خوبی هم داره."
  },
  {
    name: "سارا نوری",
    title: "مدیر بازاریابی دیجیتال",
    avatar: "/avatars/avatar-1.png",
    rating: 5,
    comment:
      "تولید محتوا برای شبکه‌های اجتماعی همیشه چالش‌برانگیز بود. با Rhyno AI، ایده‌های جذاب و کپشن‌های حرفه‌ای رو در چند دقیقه آماده می‌کنم. واقعاً یک دستیار خلاق و همه‌چی تمامه."
  },
  {
    name: "مریم حسینی",
    title: "دانشجو",
    avatar: "/avatars/avatar-3.png",
    rating: 4,
    comment:
      "برای تحلیل داده‌های پروژه‌ دانشگاهی ازش استفاده کردم. قابلیت تحلیل فایل اکسلش واقعاً قدرتمنده و کارم رو خیلی راحت کرد."
  },
  {
    name: "امیر قاسمی",
    title: "صاحب کسب‌وکار آنلاین",
    avatar: "/avatars/avatar-4.png",
    rating: 5,
    comment:
      "قبلاً برای کارهای مختلف باید از چند ابزار متفاوت استفاده می‌کردم. Rhyno AI همه چیز رو یکجا جمع کرده، از تولید محتوا گرفته تا پاسخ به ایمیل‌ها. بهترین سرمایه‌گذاری برای افزایش بهره‌وری تیم ما بود."
  },
  {
    name: "فاطمه احمدی",
    title: "تولیدکننده پادکست",
    avatar: "/avatars/avatar-5.png",
    rating: 5,
    comment:
      "کیفیت تبدیل متن به صداش بی‌نظیره! صداها کاملاً طبیعی و بدون حس رباتیک هستن. برای تولید نریشن‌های پادکستم ازش استفاده می‌کنم و از نتیجه کاملاً راضی‌ام."
  },
  {
    name: "رضا محمودی",
    title: "گرافیست و طراح",
    avatar: "/avatars/avatar-6.png",
    rating: 4,
    comment:
      "برای گرفتن ایده اولیه و اتود زدن طرح‌ها، ابزار تولید تصویرش عالیه. شاید جایگزین کار یک طراح حرفه‌ای نشه، اما سرعت ایده‌پردازی رو به شدت بالا می‌بره و خلاقیت رو تحریک می‌کنه."
  }
]

// کامپوننت برای نمایش ستاره‌های امتیاز
const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <FiStar
        key={i}
        className={`size-5 ${i < rating ? "text-yellow-400" : "text-gray-600"}`}
        fill={i < rating ? "currentColor" : "none"}
      />
    ))}
  </div>
)

const Testimonials = () => {
  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.2,
        duration: 0.6,
        ease: easeOut
      }
    })
  }

  return (
    <section className="py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8 }}
      >
        <h2 className="mb-4 text-center text-3xl font-bold text-white sm:text-4xl">
          کاربران ما چه می‌گویند؟
        </h2>
        <p className="mb-12 text-center text-lg text-gray-400">
          نگاهی به تجربه برخی از کاربران حرفه‌ای ما بیندازید.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {testimonialsData.map((testimonial, i) => (
          <motion.div
            key={i}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={cardVariants}
            className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80 p-6 transition-all duration-300 hover:border-green-500/50 hover:bg-gray-900"
          >
            {/* افکت درخشش (Glow) سبز رنگ */}
            <div
              className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-10"
              style={{
                backgroundImage: `radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.3), transparent 70%)`
              }}
            />
            <div className="relative z-10 flex h-full flex-col">
              <div className="mb-4 flex items-center">
                <Image
                  src={testimonial.avatar}
                  width={48}
                  height={48}
                  alt={testimonial.name}
                  className="rounded-full object-cover"
                />
                <div className="mr-4">
                  <h3 className="font-semibold text-white">
                    {testimonial.name}
                  </h3>
                  <p className="text-sm text-gray-400">{testimonial.title}</p>
                </div>
              </div>
              <p className="mb-4 grow text-gray-300">
                &quot;{testimonial.comment}&quot;
              </p>

              <div className="mt-auto">
                <StarRating rating={testimonial.rating} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default Testimonials
