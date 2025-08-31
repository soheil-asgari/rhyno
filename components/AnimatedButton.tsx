"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ReactNode } from "react"

interface AnimatedButtonProps {
  href: string
  children: ReactNode
  className?: string
}

export default function AnimatedButton({
  href,
  children,
  className
}: AnimatedButtonProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.3 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <Link
        href={href}
        className={`inline-block rounded-lg bg-white px-6 py-3 font-bold text-black transition-colors duration-300 hover:bg-gray-200 md:px-8 md:py-4 ${className}`}
      >
        {children}
      </Link>
    </motion.div>
  )
}
