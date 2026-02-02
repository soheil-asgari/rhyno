// components/RhynoAutoUI.tsx
"use client"

import React, { useState, useRef, ChangeEvent } from "react"
import html2canvas from "html2canvas"

// نوع (Type) برای اقدامی که از سرور می‌آید
type AgentAction = {
  name: string
  arguments: string // این یک رشته JSON است
}

export function RhynoAutoUI() {
  const [targetUrl, setTargetUrl] = useState("https://www.google.com")
  const [prompt, setPrompt] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [agentHistory, setAgentHistory] = useState<any[]>([])
  const [agentStatus, setAgentStatus] = useState("آماده به کار")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // --- بخش ۱: گرفتن اسکرین‌شات ---
  const takeScreenshot = async (): Promise<string> => {
    if (!iframeRef.current) {
      throw new Error("Iframe not found.")
    }

    // ❗️ هشدار: این فقط در صورتی کار می‌کند که محتوای iframe از
    // ❗️ همان دامنه (Origin) وب‌سایت شما باشد.
    // ❗️ برای سایت‌های خارجی (مثل google.com) به دلیل خطای CORS شکست می‌خورد.
    // ❗️ (راه حل این مشکل در انتهای توضیحات آمده است)
    try {
      const canvas = await html2canvas(
        iframeRef.current.contentWindow!.document.body,
        {
          useCORS: true, // تلاش برای فعال کردن CORS
          allowTaint: true
        }
      )
      return canvas.toDataURL("image/jpeg") // "data:image/jpeg;base64,..."
    } catch (e) {
      console.error("Screenshot failed:", e)
      setAgentStatus(
        "خطا: به دلیل امنیت مرورگر، امکان عکس گرفتن از این سایت وجود ندارد."
      )
      throw e
    }
  }

  // --- بخش ۲: اجرای دستورات ---
  const executeAction = (action: AgentAction): boolean => {
    // ❗️ هشدار: این بخش بسیار پیچیده است.
    // ❗️ دستکاری مستقیم iframe از یک دامنه دیگر غیرممکن است.
    // ❗️ این کدها فقط به عنوان *مثال* هستند.
    try {
      const args = JSON.parse(action.arguments)
      setAgentStatus(`در حال اجرا: ${action.name} ${JSON.stringify(args)}`)

      const iframeDoc = iframeRef.current?.contentWindow?.document

      if (!iframeDoc) {
        setAgentStatus("خطا: دسترسی به iframe وجود ندارد.")
        return false
      }

      switch (action.name) {
        case "click":
          // مثال: پیدا کردن عنصر در مختصات و کلیک
          // const elem = iframeDoc.elementFromPoint(args.x, args.y)
          // (elem as HTMLElement)?.click()
          console.warn(
            `[AGENT] شبیه‌سازی کلیک در: ${args.x}, ${args.y}. (این بخش نیاز به پیاده‌سازی کامل دارد)`
          )
          break

        case "type_text":
          // مثال: پیدا کردن عنصر فعال و تایپ
          // const activeElem = iframeDoc.activeElement
          // (activeElem as HTMLInputElement).value = args.text
          console.warn(
            `[AGENT] شبیه‌سازی تایپ: ${args.text}. (این بخش نیاز به پیاده‌سازی کامل دارد)`
          )
          break

        case "scroll":
          iframeRef.current?.contentWindow?.scrollBy(
            0,
            args.direction === "down" ? 300 : -300
          )
          break

        case "finish_task":
          setAgentStatus(`پایان کار: ${args.message}`)
          setIsRunning(false)
          return false // توقف حلقه

        default:
          setAgentStatus(`اقدام ناشناخته: ${action.name}`)
      }
      return true // ادامه حلقه
    } catch (e) {
      console.error("Action execution failed:", e)
      setAgentStatus("خطا در اجرای دستور.")
      return false
    }
  }

  // --- بخش ۳: حلقه اصلی عامل (Agent Loop) ---
  const runAgentLoop = async (currentPrompt: string, currentHistory: any[]) => {
    if (!isRunning) return // متوقف شده توسط کاربر

    setAgentStatus("در حال گرفتن اسکرین‌شات...")
    let screenshot = ""
    try {
      screenshot = await takeScreenshot()
    } catch (e) {
      setIsRunning(false)
      return // متوقف کردن حلقه در صورت خطای اسکرین‌شات
    }

    setAgentStatus("در حال ارسال اسکرین‌شات به مدل...")

    try {
      const response = await fetch("/api/agent/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenshot: screenshot,
          user_prompt: currentPrompt,
          history: currentHistory,
          model_id: "google/gemini-2.5-pro"
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || "خطا در API ایجنت")
      }

      const action = (await response.json()) as AgentAction

      // اضافه کردن اقدام به تاریخچه
      const newHistory = [
        ...currentHistory,
        {
          role: "assistant",
          content: null,
          tool_calls: [{ type: "function", function: action }]
        }
        // می‌توانید نتیجه اجرای ابزار را هم اضافه کنید
      ]
      setAgentHistory(newHistory)

      // اجرای اقدام
      setAgentStatus("در حال اجرای دستور مدل...")
      const shouldContinue = executeAction(action)

      // تکرار حلقه
      if (shouldContinue) {
        // کمی تأخیر برای بارگذاری صفحه پس از اقدام
        setTimeout(() => runAgentLoop(currentPrompt, newHistory), 2000)
      }
    } catch (error: any) {
      setAgentStatus(`خطا: ${error.message}`)
      setIsRunning(false)
    }
  }

  // --- بخش ۴: کنترل‌گرها ---
  const handleStartAgent = () => {
    if (!prompt) {
      setAgentStatus("لطفاً یک دستورالعمل وارد کنید.")
      return
    }
    setAgentStatus("ایجنت شروع به کار کرد...")
    setIsRunning(true)
    setAgentHistory([]) // ریست کردن تاریخچه
    // اجرای حلقه برای اولین بار
    runAgentLoop(prompt, [])
  }

  const handleStopAgent = () => {
    setAgentStatus("ایجنت توسط کاربر متوقف شد.")
    setIsRunning(false)
  }

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTargetUrl(e.target.value)
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "80vh",
        border: "1px solid #555",
        borderRadius: "8px",
        overflow: "hidden"
      }}
    >
      {/* ۱. نوار آدرس و کنترل */}
      <div
        style={{
          padding: "10px",
          backgroundColor: "#222",
          display: "flex",
          gap: "10px"
        }}
      >
        <input
          type="text"
          value={targetUrl}
          onChange={handleUrlChange}
          placeholder="آدرس وب‌سایت (https://...)"
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: "#444",
            color: "white"
          }}
        />
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="دستور شما (مثال: در این سایت برای من ثبت نام کن)"
          style={{
            flex: 2,
            padding: "8px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: "#444",
            color: "white"
          }}
          disabled={isRunning}
        />
        {isRunning ? (
          <button onClick={handleStopAgent} style={buttonStyle("red")}>
            توقف
          </button>
        ) : (
          <button onClick={handleStartAgent} style={buttonStyle("green")}>
            شروع
          </button>
        )}
      </div>

      {/* ۲. نمایشگر وضعیت */}
      <div
        style={{
          padding: "5px 10px",
          backgroundColor: "#111",
          color: "cyan",
          fontFamily: "monospace",
          fontSize: "14px",
          borderTop: "1px solid #333"
        }}
      >
        وضعیت: {agentStatus}
      </div>

      {/* ۳. مرورگر (iframe) */}
      <div style={{ flex: 1, borderTop: "1px solid #333", overflow: "hidden" }}>
        <iframe
          ref={iframeRef}
          src={targetUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            backgroundColor: "#fff"
          }}
          // ❗️ sandbox="allow-scripts allow-same-origin"
          // سندباکس امنیت را بالا می‌برد اما ممکن است جلوی کلیک‌ها را بگیرد
        />
      </div>
    </div>
  )
}

// استایل دکمه‌ها (می‌توانید از Tailwind استفاده کنید)
const buttonStyle = (color: string): React.CSSProperties => ({
  padding: "8px 16px",
  border: "none",
  borderRadius: "4px",
  backgroundColor: color,
  color: "white",
  cursor: "pointer",
  fontWeight: "bold"
})
