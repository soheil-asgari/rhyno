// lib/hooks/use-voice-recorder.ts

import { useState, useRef } from "react"
import { toast } from "sonner"

/**
 * A custom hook for recording audio.
 * This hook is only responsible for the recording process.
 * It returns the final audio Blob via the onRecordingComplete callback.
 * All API calls and transcription logic should be handled in the component that uses this hook.
 */
export const useVoiceRecorder = (
  onRecordingComplete: (audioBlob: Blob) => void
) => {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm"
        })
        stream.getTracks().forEach(track => track.stop()) // Stop microphone access
        setIsRecording(false)

        if (audioBlob.size > 0) {
          // ✨ فایل صوتی ضبط شده را مستقیماً به تابع callback ارسال می‌کند
          onRecordingComplete(audioBlob)
        }
      }

      mediaRecorderRef.current.onerror = event => {
        console.error("MediaRecorder error:", event)
        toast.error("خطایی در ضبط صدا رخ داد.")
        setIsRecording(false)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Error accessing microphone:", error)
      toast.error("دسترسی به میکروفون امکان‌پذیر نیست.")
    }
  }

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // ✨ این هوک دیگر مسئول رونویسی صدا نیست، بنابراین isTranscribing را برنمی‌گرداند
  return { isRecording, handleToggleRecording }
}
