// components/FaqAccordion.tsx
"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FiChevronDown } from "react-icons/fi"
import { cn } from "@/lib/utils"

type FaqItemProps = {
  question: string
  answer: string
}

type FaqAccordionProps = {
  data: FaqItemProps[]
  className?: string
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    // ✅ آپدیت رنگ بوردر
    <div className="border-b border-black/10 transition-colors duration-300 dark:border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-5 text-right"
      >
        {/* ✅ آپدیت رنگ متن سوال */}
        <span className="text-lg font-medium text-black transition-colors duration-300 dark:text-white">
          {question}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          {/* ✅ آپدیت رنگ آیکون */}
          <FiChevronDown className="size-5 text-gray-500 transition-colors duration-300 dark:text-gray-400" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {/* ✅ آپدیت رنگ متن پاسخ */}
            <p className="pb-5 pr-2 text-base text-gray-700 transition-colors duration-300 dark:text-gray-400">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FaqAccordion({ data, className = "" }: FaqAccordionProps) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)}>
      {data.map((item, i) => (
        <FaqItem key={i} question={item.question} answer={item.answer} />
      ))}
    </div>
  )
}
