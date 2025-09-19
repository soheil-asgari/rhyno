// CircularAudioVisualizer.tsx (نسخه بهینه‌سازی شده)
import { FC, useMemo } from "react"
import { motion } from "framer-motion"

interface CircularAudioVisualizerProps {
  volume: number
  numBars?: number
  radius?: number
  barWidth?: number
  baseHue?: number
}

export const CircularAudioVisualizer: FC<CircularAudioVisualizerProps> = ({
  volume,
  numBars = 50, // ✨ ۱. تعداد نوارها کاهش یافت
  radius = 90,
  barWidth = 3, // کمی ضخیم‌تر برای جبران تعداد کمتر
  baseHue = 200
}) => {
  const baseHeight = Math.max(4, volume * 1.5)

  const bars = useMemo(
    () =>
      Array.from({ length: numBars }).map((_, i) => ({
        angle: i * (360 / numBars)
      })),
    [numBars]
  )

  const barVariants = {
    initial: { height: 4, opacity: 0.5 },
    animate: (custom: { height: number }) => ({
      height: custom.height,
      opacity: 1,
      // ✨ ۳. انیمیشن ساده‌تر شد
      transition: { duration: 0.1, ease: "easeOut" as const }
    })
  }

  return (
    <motion.div
      className="relative"
      style={{ width: radius * 2, height: radius * 2 }}
      initial="initial"
      animate="animate"
    >
      {bars.map(({ angle }, i) => {
        const barHeight =
          baseHeight + Math.sin((i / numBars) * Math.PI) * baseHeight * 0.6
        const hue = baseHue + (angle / 360) * 80

        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: barWidth,
              transformOrigin: "center bottom",
              transform: `rotate(${angle}deg) translateY(-${radius}px)`,
              backgroundColor: `hsl(${hue}, 100%, 60%)`
              // ✨ ۲. افکت سنگین drop-shadow حذف شد
            }}
            variants={barVariants}
            custom={{ height: Math.min(barHeight, radius - 20) }}
          />
        )
      })}
    </motion.div>
  )
}
