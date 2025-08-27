import { useState, useEffect, useRef } from "react"

export const useAudioVisualizer = (stream: MediaStream | null) => {
  const [volume, setVolume] = useState(0)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    // اگر استریم وجود ندارد یا ترک صوتی ندارد، کاری انجام نده
    if (!stream || stream.getAudioTracks().length === 0) {
      setVolume(0)
      return
    }

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)

    source.connect(analyser)
    analyser.fftSize = 32 // اندازه کوچک برای محاسبه سریع حجم صدا
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const animate = () => {
      analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength
      setVolume(average / 255) // نرمال‌سازی حجم صدا بین ۰ و ۱
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    // تابع پاکسازی برای جلوگیری از نشت حافظه
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContext.state !== "closed") {
        source.disconnect()
        analyser.disconnect()
        audioContext.close()
      }
    }
  }, [stream]) // این افکت فقط زمانی اجرا می‌شود که استریم تغییر کند

  return volume
}
