// components/CollapsibleText.tsx (نسخه جدید و ساده شده)
import { FC } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

interface CollapsibleTextProps {
  text: string
  isCollapsed: boolean // ✨ فقط این prop را دریافت می‌کند
  maxLength?: number
  className?: string
}

export const CollapsibleText: FC<CollapsibleTextProps> = ({
  text,
  isCollapsed,
  maxLength = 250,
  className
}) => {
  const showToggle = text.length > maxLength
  // اگر پیام کوتاه باشد، هرگز جمع نمی‌شود
  const shouldBeCollapsed = showToggle && isCollapsed
  const displayedText = shouldBeCollapsed
    ? text.slice(0, maxLength) + "..."
    : text

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={text} // کلید را متن قرار می‌دهیم تا با تغییر متن انیمیشن ریست شود
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <p className={cn("whitespace-pre-wrap", className)}>{displayedText}</p>
      </motion.div>
    </AnimatePresence>
  )
}
