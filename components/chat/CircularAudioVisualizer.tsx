// CircularAudioVisualizer.tsx
import { FC, useMemo } from "react"
import { motion } from "framer-motion"

// Props را گسترش می‌دهیم تا کامپوننت قابل تنظیم باشد
interface CircularAudioVisualizerProps {
  volume: number // ورودی صدا بین 0 تا ~100
  numBars?: number
  radius?: number
  barWidth?: number
  // رنگ پایه برای شروع گرادیانت (مقدار hue در HSL)
  baseHue?: number
}

export const CircularAudioVisualizer: FC<CircularAudioVisualizerProps> = ({
  volume,
  numBars = 90,
  radius = 90,
  barWidth = 2,
  baseHue = 200 // شروع از رنگ آبی
}) => {
  // ارتفاع پایه نوارها را محاسبه می‌کنیم
  const baseHeight = Math.max(4, volume * 1.5)

  // ✨ بهینه‌سازی: محاسبات زوایا فقط یک بار انجام می‌شود
  const bars = useMemo(
    () =>
      Array.from({ length: numBars }).map((_, i) => ({
        angle: i * (360 / numBars)
      })),
    [numBars]
  )

  // ✨ واریانت‌های انیمیشن برای افکت آبشاری
  const containerVariants = {
    animate: {
      transition: {
        staggerChildren: 0.02 // تاخیر بین انیمیشن هر نوار
      }
    }
  }

  const barVariants = {
    initial: { height: 4, opacity: 0.5 },
    animate: (custom: { height: number }) => ({
      height: custom.height,
      opacity: 1,
      // ✨ استفاده از انیمیشن فنری برای حس طبیعی‌تر
      transition: { type: "spring" as const, damping: 10, stiffness: 100 }
    })
  }

  return (
    <motion.div
      className="relative"
      style={{ width: radius * 2, height: radius * 2 }}
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      {bars.map(({ angle }, i) => {
        // ارتفاع هر نوار را با یک الگوی سینوسی تغییر می‌دهیم تا زیباتر شود
        const barHeight =
          baseHeight + Math.sin((i / numBars) * Math.PI) * baseHeight * 0.6

        // ✨ رنگ هر نوار بر اساس زاویه آن تغییر می‌کند
        const hue = baseHue + (angle / 360) * 80 // گرادیانت از آبی به بنفش

        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: barWidth,
              transformOrigin: "center bottom",
              transform: `rotate(${angle}deg) translateY(-${radius}px)`,
              backgroundColor: `hsl(${hue}, 100%, 60%)`, // رنگ‌بندی HSL
              // ✨ افکت درخشش برای زیبایی بیشتر
              filter: `drop-shadow(0 0 4px hsl(${hue}, 100%, 70%))`
            }}
            variants={barVariants}
            custom={{ height: Math.min(barHeight, radius - 20) }}
          />
        )
      })}
    </motion.div>
  )
}
