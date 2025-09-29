"use client"

import React, { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

// --- Icon Components ---
const IconProps = {
  strokeWidth: 2,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor"
}

const XIcon = ({ size = 20, className = "" }) => (
  <svg {...IconProps} width={size} height={size} className={className}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
)

const ArrowUpIcon = ({ size = 18, className = "" }) => (
  <svg {...IconProps} width={size} height={size} className={className}>
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  </svg>
)

const LoaderIcon = ({ size = 16, className = "" }) => (
  <svg
    {...IconProps}
    width={size}
    height={size}
    className={cn("animate-spin", className)}
  >
    <line x1="12" y1="2" x2="12" y2="6"></line>
    <line x1="12" y1="18" x2="12" y2="22"></line>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
    <line x1="2" y1="12" x2="6" y2="12"></line>
    <line x1="18" y1="12" x2="22" y2="12"></line>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
  </svg>
)

// رابط برای نوع پیام‌ها با ID
interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export default function FreeChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-message",
      role: "assistant",
      content:
        "سلام! چطور می‌تونم کمکتون کنم؟ سوالی بپرسید تا با یکی از مدل‌های رایگان به شما پاسخ بدم."
    }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isChatOpen])

  const handleFocus = () => {
    setIsChatOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setIsChatOpen(true)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input
    }

    setMessages(prev => [
      ...prev,
      userMessage,
      { id: (Date.now() + 1).toString(), role: "assistant", content: "" }
    ])

    const messagesToSend = [...messages, userMessage].map(
      ({ role, content }) => ({ role, content })
    )
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/free-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "خطا در ارتباط با سرور.")
      }

      if (!response.body) {
        throw new Error("پاسخ دریافتی خالی است.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1].content += chunk
          return newMessages
        })
      }
    } catch (error: any) {
      setMessages(prev => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1].content =
          `متاسفانه مشکلی پیش آمد: ${error.message}`
        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="font-vazir pointer-events-none fixed inset-x-0 bottom-0 z-50 w-full p-2 sm:p-4">
      {/* ✨ تغییر ۱: عرض کانتینر کمتر شد */}
      <div className="mx-auto max-w-xl">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              // ✨ تغییر ۲: پس‌زمینه پنجره چت مات شد (حذف /80)
              className="pointer-events-auto mb-3 flex h-[60vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-950 shadow-2xl md:h-[70vh]"
            >
              <header className="flex items-center justify-between border-b border-white/10 p-4">
                <h3 className="font-bold text-white">
                  چت رایگان با هوش مصنوعی
                </h3>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-gray-400 transition-colors hover:text-white"
                  aria-label="بستن چت"
                >
                  <XIcon />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col space-y-4">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex max-w-[85%] flex-col rounded-lg px-3 py-2",
                        {
                          "self-end bg-blue-600 text-white":
                            msg.role === "user",
                          "self-start bg-gray-800 text-gray-300":
                            msg.role === "assistant"
                        }
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  ))}

                  {isLoading &&
                    messages.length > 0 &&
                    messages[messages.length - 1].role === "user" && (
                      <div className="self-start rounded-lg bg-gray-800 px-3 py-2 text-gray-300">
                        <div className="flex items-center gap-2">
                          <LoaderIcon />
                          <span>در حال پردازش...</span>
                        </div>
                      </div>
                    )}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="pointer-events-auto w-full">
          <div className="flex items-center rounded-full bg-gray-900/80 p-2 shadow-lg ring-1 ring-white/10">
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-700 text-white transition-colors enabled:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="ارسال پیام"
            >
              <ArrowUpIcon />
            </button>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={handleFocus}
              placeholder="از هوش مصنوعی رایگان بپرسید..."
              className="w-full bg-transparent px-4 text-right text-sm text-gray-300 placeholder:text-gray-500 focus:outline-none focus:ring-0"
              disabled={isLoading}
            />
          </div>
        </form>
      </div>
    </div>
  )
}
