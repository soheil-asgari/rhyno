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
    name: "سارا رضایی",
    title: "توسعه‌دهنده وب",
    avatar: "/avatars/avatar-1.png", // فرض می‌کنیم عکس‌ها در public/avatars/ هستن
    rating: 5,
    comment:
      "سرعت و دقت Rhyno AI در کدنویسی بی‌نظیره. ساعت‌ها در وقت من صرفه‌جویی کرده و به ابزار اصلی من برای پروژه‌هام تبدیل شده."
  },
  {
    name: "علی محمدی",
    title: "مدیر محتوا",
    avatar: "/avatars/avatar-2.png",
    rating: 5,
    comment:
      "تولید محتوا با Rhyno AI فوق‌العاده است. از تولید پست‌های وبلاگ تا کپشن‌های شبکه‌های اجتماعی، همیشه ایده‌های خلاقانه و متن‌های باکیفیت تحویل می‌ده."
  },
  {
    name: "مریم حسینی",
    title: "دانشجو",
    avatar: "/avatars/avatar-3.png",
    rating: 4,
    comment:
      "برای تحلیل داده‌های پروژه‌ دانشگاهی ازش استفاده کردم. قابلیت تحلیل فایل اکسلش واقعاً قدرتمنده و کارم رو خیلی راحت کرد."
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
