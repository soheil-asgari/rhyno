"use client"

import { motion, Variants } from "framer-motion"
import { FiZap, FiCpu, FiRepeat, FiLock } from "react-icons/fi"
import { SectionTitle } from "@/components/SectionTitle"
import React from "react"

export default function Features() {
  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  }

  const features = [
    {
      icon: <FiZap />,
      title: "سرعت بی‌نظیر",
      desc: "پاسخ‌ها را در کسری از ثانیه دریافت کنید"
    },
    {
      icon: <FiCpu />,
      title: "مدل‌های بهینه",
      desc: "بهترین عملکرد با مدل‌های بهینه و آماده استفاده"
    },
    {
      icon: <FiRepeat />,
      title: "تجربه یکپارچه",
      desc: "تمام ابزارها در یک داشبورد یکپارچه، مدیریت ساده‌تر"
    },
    {
      icon: <FiLock />,
      title: "امنیت کامل",
      desc: "امنیت و حریم خصوصی شما، اولویت ماست"
    }
  ]

  return (
    <section className="py-16 md:py-24">
      <SectionTitle>
        چرا <span dir="ltr">Rhyno AI</span> بهترین انتخاب است؟
      </SectionTitle>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors duration-300 hover:border-gray-600 hover:bg-gray-800 sm:p-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            variants={fadeInUp}
          >
            <div className="mb-3 text-white">
              {React.cloneElement(feature.icon, { className: "h-7 w-7" })}
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">
              {feature.title}
            </h3>
            <p className="text-sm text-gray-400">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
