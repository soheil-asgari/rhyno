"use client"

import { motion, Variants } from "framer-motion"
import { useState, useEffect } from "react"
import AnimatedButton from "@/components/AnimatedButton"
import Image from "next/image"
import HeaderBrand from "@/components/HeaderBrand"

const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint)
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [breakpoint])
  return isMobile
}

export default function HeroSection() {
  const isMobile = useIsMobile()

  const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  }

  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: isMobile ? 0.1 : 0.2 } }
  }

  return (
    <>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="border-b border-gray-800 py-4"
      >
        <nav className="container mx-auto flex items-center justify-between px-4">
          <HeaderBrand />
          <AnimatedButton
            href="/login"
            className="flex items-center space-x-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm font-bold text-black hover:bg-gray-800 hover:text-white sm:space-x-2 sm:px-4 sm:py-2 rtl:space-x-reverse"
          >
            <span className="hidden sm:inline">ورود به حساب</span>
            <span className="sm:hidden">ورود</span>
          </AnimatedButton>
        </nav>
      </motion.header>

      {/* Hero Section */}
      <motion.section
        className="py-16 text-center md:py-24"
        initial={isMobile ? "visible" : "hidden"}
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={containerVariants}
      >
        <motion.h1
          className="mb-4 text-3xl font-extrabold leading-tight text-white sm:text-5xl md:text-6xl"
          variants={fadeInUp}
        >
          مرکز فرماندهی هوش مصنوعی شما
        </motion.h1>

        <motion.p
          className="mx-auto max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg"
          variants={fadeInUp}
          dir="rtl"
        >
          همه مدل‌های قدرتمند <span dir="ltr">AI</span> در دستان شما، سریع و
          بدون پیچیدگی.
        </motion.p>

        <motion.div variants={fadeInUp} className="mt-8">
          <AnimatedButton
            href="#pricing"
            className="inline-block rounded-lg bg-white px-6 py-3 font-bold text-black hover:bg-gray-200"
          >
            شروع قدرتمند
          </AnimatedButton>
        </motion.div>
      </motion.section>

      {/* Hero Image */}
      <motion.div
        className="my-10"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        whileHover={{ scale: 1.05 }}
      >
        <Image
          src="/rhyno_white.png"
          alt="Rhyno AI visual representation"
          width={1024}
          height={1024}
          className="w-55 mx-auto rounded-xl object-cover sm:w-48 md:w-80"
        />
      </motion.div>
    </>
  )
}
