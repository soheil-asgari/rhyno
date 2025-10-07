"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button" // فرض می‌کنیم از shadcn/ui استفاده می‌کنید

const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

interface StepContainerProps {
  stepNum: number
  stepTitle: string
  stepDescription: string
  children: React.ReactNode
  onShouldProceed: (proceed: boolean) => void
  showNextButton: boolean
  showBackButton: boolean
}

export const StepContainer = ({
  stepNum,
  stepTitle,
  stepDescription,
  children,
  onShouldProceed,
  showNextButton,
  showBackButton
}: StepContainerProps) => {
  return (
    <motion.div
      // واکنش‌گرایی در عرض: در موبایل تمام عرض و در صفحات بزرگتر حداکثر عرض مشخص
      className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900/50 p-6 shadow-lg md:p-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="text-2xl font-bold text-white">{stepTitle}</h2>
          <p className="text-md mt-2 text-gray-300">{stepDescription}</p>
        </motion.div>

        {/* Content */}
        <motion.div variants={itemVariants}>{children}</motion.div>

        {/* Footer with Buttons */}
        <motion.div
          variants={itemVariants}
          // واکنش‌گرایی دکمه‌ها: در موبایل زیر هم و در صفحات بزرگتر کنار هم
          className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-between"
        >
          <div>
            {showBackButton && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onShouldProceed(false)}
              >
                Back
              </Button>
            )}
          </div>

          <div>
            {showNextButton && (
              <Button
                className="w-full sm:w-auto"
                onClick={() => onShouldProceed(true)}
              >
                {stepNum === 2 ? "Finish Setup" : "Next"}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
