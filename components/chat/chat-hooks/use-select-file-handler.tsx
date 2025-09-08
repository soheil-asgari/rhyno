"use client" // حتماً کلاینت ساید

import { ChatbotUIContext } from "@/context/context"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import mammoth from "mammoth"
import * as XLSX from "xlsx"

// انواع فایل‌های مجاز
export const ACCEPTED_FILE_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/json",
  "text/markdown",
  "application/pdf",
  "text/plain"
]

export const useSelectFileHandler = () => {
  const {
    chatSettings,
    setNewMessageImages,
    setNewMessageFiles,
    setShowFilesDisplay,
    setUseRetrieval
  } = useContext(ChatbotUIContext)
  const [filesToAccept, setFilesToAccept] = useState(
    ACCEPTED_FILE_TYPES.join(",")
  )

  useEffect(() => {
    const model = chatSettings?.model
    const fullModel = LLM_LIST.find(llm => llm.modelId === model)
    if (fullModel?.imageInput) {
      setFilesToAccept(`${ACCEPTED_FILE_TYPES.join(",")},image/*`)
    } else {
      setFilesToAccept(ACCEPTED_FILE_TYPES.join(","))
    }
  }, [chatSettings?.model])

  // --- نسخه دیباگ: تولید پیش‌نمایش PDF با لاگ‌های مرحله به مرحله ---
  const generatePdfPreview = async (file: File): Promise<string | null> => {
    console.log("--- Starting PDF Preview Generation ---")
    try {
      if (typeof window === "undefined") {
        console.log("Exiting: Not in a browser environment.")
        return null
      }

      const PDF_VERSION = "3.11.174"
      const PDFJS_SCRIPT_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.js`
      const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.js`

      if (!(window as any).pdfjsLib) {
        console.log(
          "Step 1: pdf.js library not found. Attempting to load from CDN..."
        )
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script")
          script.src = PDFJS_SCRIPT_URL
          script.onload = () => {
            console.log("Step 2: pdf.js script loaded successfully.")
            resolve()
          }
          script.onerror = () =>
            reject(new Error("Failed to load pdf.js library from CDN."))
          document.head.appendChild(script)
        })
      } else {
        console.log("Step 1 & 2: pdf.js library already loaded.")
      }

      if (!(window as any).pdfjsLib) {
        throw new Error(
          "Critical Error: pdf.js script loaded but `pdfjsLib` is not available on the window object."
        )
      }

      const pdfjsLib = (window as any).pdfjsLib
      console.log("Step 3: pdfjsLib object is available.")

      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
      console.log("Step 4: PDF worker source is set.")

      const arrayBuffer = await file.arrayBuffer()
      console.log("Step 5: File converted to ArrayBuffer.")

      console.log("Step 6: Calling getDocument(). This may take a moment...")
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      console.log("Step 7: PDF document loaded successfully.")

      const page = await pdf.getPage(1)
      console.log("Step 8: Got the first page.")

      const viewport = page.getViewport({ scale: 1 })
      const canvas = document.createElement("canvas")
      canvas.width = viewport.width
      canvas.height = viewport.height
      const context = canvas.getContext("2d")!
      console.log("Step 9: Canvas created.")

      await page.render({
        canvas: canvas,
        canvasContext: context,
        viewport: viewport
      }).promise
      console.log("Step 10: Page rendered to canvas.")

      console.log("--- PDF Preview Generation Finished Successfully ---")
      return canvas.toDataURL()
    } catch (error) {
      console.error("--- ERROR during PDF Preview Generation ---", error)
      return null
    }
  }

  // --- پیش‌نمایش DOCX ---
  const generateDocxPreview = async (file: File) => {
    if (typeof window === "undefined") return null
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value.slice(0, 100)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    canvas.width = 300
    canvas.height = 150
    ctx.fillStyle = "#f5f5f5"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#000"
    ctx.font = "14px Arial"
    ctx.fillText(text, 10, 20)
    return canvas.toDataURL()
  }

  // --- پیش‌نمایش XLSX ---
  const generateXlsxPreview = async (file: File) => {
    if (typeof window === "undefined") return null
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: "array" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]
    const previewText = json
      .slice(0, 5)
      .map(row => row.join(" | "))
      .join("\n")

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    canvas.width = 300
    canvas.height = 150
    ctx.fillStyle = "#f5f5f5"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = "#000"
    ctx.font = "12px Arial"
    ctx.fillText(previewText, 10, 20)
    return canvas.toDataURL()
  }

  // --- آیکون fallback ---
  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return URL.createObjectURL(file)
    if (file.type === "application/pdf") return "/icons/pdf-icon.png"
    if (file.type.includes("word")) return "/icons/word-icon.png"
    if (file.type.includes("excel")) return "/icons/excel-icon.png"
    if (file.type === "text/csv") return "/icons/csv-icon.png"
    if (file.type === "text/plain") return "/icons/txt-icon.png"
    return "/icons/file-icon.png"
  }

  // --- مدیریت انتخاب فایل ---
  const handleSelectDeviceFile = async (file: File) => {
    console.log("File Selected:", { name: file.name, type: file.type })
    setShowFilesDisplay(true)
    setUseRetrieval(true)
    try {
      // 1. ساخت یک FormData برای ارسال فایل
      const formData = new FormData()
      formData.append("file", file)

      // 2. ارسال فایل به یک API endpoint جدید در سرور
      // شما باید این endpoint را بسازید (مثلاً /api/file/upload)
      const response = await fetch("/api/file/upload", {
        method: "POST",
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "File upload failed")
      }

      // 3. دریافت نتیجه از سرور (که باید شامل file_id باشد)
      const result = await response.json()
      const { fileId } = result // فرض می‌کنیم سرور fileId را برمی‌گرداند

      if (!fileId) {
        throw new Error("Server did not return a file ID.")
      }

      // حالا که فایل با موفقیت در سرور پردازش شده، آن را به state اضافه می‌کنیم
      // ... (کدهای مربوط به ساخت پیش‌نمایش را اینجا قرار دهید)

      setNewMessageFiles(prev => [
        ...prev,
        {
          id: fileId, // <-- از ID واقعی که از سرور آمده استفاده می‌کنیم
          name: file.name,
          type: file.type,
          file: file,
          preview: preview // پیش‌نمایشی که ساخته‌اید
        }
      ])
    } catch (error: any) {
      toast.error(error.message)
      console.error("Error uploading file:", error)
      // در صورت خطا، فایل به لیست اضافه نمی‌شود
      return
    }
    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onloadend = () => {
        setNewMessageImages(prev => [
          ...prev,
          {
            messageId: "temp",
            path: "",
            base64: reader.result as string,
            url: URL.createObjectURL(file),
            file
          }
        ])
      }
      return
    }

    const isFileTypeAccepted = ACCEPTED_FILE_TYPES.includes(file.type)
    if (!isFileTypeAccepted) {
      toast.error(`نوع فایل ${file.type} پشتیبانی نمی‌شود.`)
      return
    }

    let preview: string | null = null
    try {
      if (file.type === "application/pdf")
        preview = await generatePdfPreview(file)
      else if (file.type.includes("word"))
        preview = await generateDocxPreview(file)
      else if (file.type.includes("excel"))
        preview = await generateXlsxPreview(file)
      else preview = getFileIcon(file)
    } catch (err) {
      console.error("Error generating preview:", err)
      preview = getFileIcon(file)
    }

    setNewMessageFiles(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        file,
        preview
      }
    ])
  }

  return { handleSelectDeviceFile, filesToAccept }
}
