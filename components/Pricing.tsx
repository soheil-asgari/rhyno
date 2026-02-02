"use client"

import { motion } from "framer-motion"
import AnimatedButton from "@/components/AnimatedButton"

export default function Pricing() {
  return (
    <section id="pricing" className="py-16 text-center md:py-24">
      <motion.div
        className="rounded-2xl border border-gray-800 bg-gray-900 p-6 sm:p-8 md:p-12"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <h3 className="mb-2 text-2xl font-bold text-white">پلن دسترسی کامل</h3>
        <p className="mb-6 text-base text-gray-400" dir="rtl">
          همه ابزارها، همیشه و بدون محدودیت، با پلن{" "}
          <span dir="ltr" className="font-medium text-white">
            pay as you go
          </span>
        </p>

        <div className="mb-8 flex flex-wrap items-baseline justify-center gap-x-2">
          <span className="text-xl font-extrabold text-white sm:text-2xl md:text-3xl">
            برای اطلاعات بیشتر از تعرفه‌ها روی دکمه زیر کلیک کنید
          </span>
        </div>

        <AnimatedButton
          href="/checkout"
          className="w-full rounded-lg bg-white px-6 py-3 font-bold text-black hover:bg-gray-200 sm:w-auto md:px-10 md:py-4"
        >
          تهیه اشتراک و شروع استفاده
        </AnimatedButton>
      </motion.div>
    </section>
  )
}
