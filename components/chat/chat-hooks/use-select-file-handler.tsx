import { ChatbotUIContext } from "@/context/context"
import { createDocXFile, createFile } from "@/db/files"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import mammoth from "mammoth"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"
// این import ها را به بالای فایل useSelectFileHandler.tsx اضافه کنید
import imageCompression from "browser-image-compression"
import { supabase } from "@/lib/supabase/browser-client"
import { uploadMessageImage } from "@/db/storage/message-images"
import { v4 as uuidv4 } from "uuid"

let pdfjsLib: any = null

const extractPdfText = async (file: File) => {
  // حفاظت از سمت سرور
  if (typeof window === "undefined") {
    throw new Error("PDF parsing only works in the browser")
  }

  if (!pdfjsLib) {
    try {
      // ✨ تغییر کلیدی: هدف قرار دادن مستقیم فایل build.
      // از مسیر "pdfjs-dist/build/pdf.min.mjs" استفاده کنید
      const pdfjsModule = await import("pdfjs-dist/build/pdf.min.mjs")

      // گرفتن شیء اصلی. استفاده از `* as pdfjs` در `import()` منجر به یک wrapper می‌شود.
      // این ساختار به طور قابل اعتماد default export را استخراج می‌کند.
      pdfjsLib = pdfjsModule.default || pdfjsModule

      if (!pdfjsLib || typeof pdfjsLib.getDocument !== "function") {
        throw new Error("PDF.js object not properly loaded.")
      }

      // تنظیم مسیر Worker (استفاده از CDN توصیه شده است)
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.js`
    } catch (error) {
      // این خطا را لاگ کنید تا مسیر دقیق شکست را ببینیم
      console.error("🔴 خطا در بارگیری PDF.js. Import ناموفق بود:", error)
      throw new Error("Cannot load PDF parsing library.")
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  // این خط اکنون باید کار کند، زیرا pdfjsLib باید شیء معتبری باشد.
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let text = ""
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item: any) => item.str).join(" ") + "\n"
  }

  return text
}

// این بخش بدون تغییر باقی می‌ماند
export const ACCEPTED_FILE_TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json",
  "text/markdown",
  "application/pdf",
  "text/plain",
  "audio/*"
].join(",")

export const useSelectFileHandler = () => {
  const {
    selectedWorkspace,
    profile,
    chatSettings,
    setNewMessageImages,
    setNewMessageFiles,
    setShowFilesDisplay,
    setFiles,
    setUseRetrieval
  } = useContext(ChatbotUIContext)

  const [filesToAccept, setFilesToAccept] = useState(ACCEPTED_FILE_TYPES)

  useEffect(() => {
    handleFilesToAccept()
  }, [chatSettings?.model])

  const handleFilesToAccept = () => {
    const model = chatSettings?.model
    const FULL_MODEL = LLM_LIST.find(llm => llm.modelId === model)
    if (!FULL_MODEL) return
    setFilesToAccept(
      FULL_MODEL.imageInput
        ? `${ACCEPTED_FILE_TYPES},image/*`
        : ACCEPTED_FILE_TYPES
    )
  }

  // ✨ تابع زیر به طور کامل بازنویسی و اصلاح شده است
  const handleSelectDeviceFile = async (file: File) => {
    if (!profile || !selectedWorkspace || !chatSettings) return

    const isImage = file.type.startsWith("image/")
    const isAudio = file.type.startsWith("audio/")
    const isAcceptedDoc = ACCEPTED_FILE_TYPES.split(",").includes(file.type)

    if (!isImage && !isAudio && !isAcceptedDoc) {
      toast.error(`فرمت فایل پشتیبانی نمی‌شود: ${file.type}`)
      return
    }

    // --- منطق جدید برای عکس‌ها (فشرده‌سازی + Base64) ---
    // --- منطق جدید برای عکس‌ها (فشرده‌سازی + Base64) ---
    if (isImage) {
      const model = LLM_LIST.find(llm => llm.modelId === chatSettings.model)
      if (!model?.imageInput) {
        toast.error(`مدل فعلی از ورودی تصویر پشتیبانی نمی‌کند.`)
        return
      }

      // --- ✨ [START] راه‌حل: پیش‌نمایش فوری ---

      // ۱. بلافاصله یک ID موقت و URL پیش‌نمایش محلی بساز
      const tempId = uuidv4() // از uuid برای یک شناسه موقت استفاده می‌کنیم
      const localPreviewUrl = URL.createObjectURL(file) // از فایل *اصلی* برای پیش‌نمایش فوری استفاده کن

      // ۲. بلافاصله UI را با پیش‌نمایش محلی آپدیت کن
      // این باعث می‌شود عکس فوراً نمایش داده شود
      setNewMessageImages(prev => [
        ...prev,
        {
          messageId: tempId, // ID موقت
          path: "uploading...", // به کامپوننت MessageImages می‌گوید اسپینر لودینگ را نشان دهد
          base64: "", // هنوز آماده نیست
          url: localPreviewUrl, // <-- URL فوری برای پیش‌نمایش
          file: file // <-- فایل اصلی (فعلاً)
        }
      ])
      setShowFilesDisplay(true)

      // ۳. حالا فشرده‌سازی و خواندن Base64 را در پس‌زمینه انجام بده
      const processImageInBackground = async () => {
        try {
          // گزینه‌های فشرده‌سازی
          const options = {
            maxSizeMB: 1, // حداکثر حجم فایل بعد از فشرده‌سازی
            maxWidthOrHeight: 1024, // حداکثر عرض یا ارتفاع
            useWebWorker: true
          }

          const compressedFile = await imageCompression(file, options)

          // ۴. تبدیل فایل فشرده به Base64
          const reader = new FileReader()
          reader.readAsDataURL(compressedFile)
          reader.onloadend = () => {
            const base64 = reader.result as string

            // ۵. آبجکت عکس در استیت را با اطلاعات کامل (فایل فشرده و Base64) آپدیت کن
            setNewMessageImages(prev =>
              prev.map(img =>
                img.messageId === tempId
                  ? {
                      ...img,
                      path: "", // <-- فشرده‌سازی تمام شد، اسپینر را مخفی کن
                      base64: base64, // <-- Base64 نهایی
                      file: compressedFile, // <-- فایل فشرده نهایی
                      url: localPreviewUrl // <-- URL پیش‌نمایش را حفظ کن
                    }
                  : img
              )
            )
          }
        } catch (error) {
          console.error("Image compression error:", error)
          toast.error("خطا در هنگام فشرده‌سازی عکس.")
          // اگر فشرده‌سازی شکست خورد، عکس موقت را از UI حذف کن
          setNewMessageImages(prev =>
            prev.filter(img => img.messageId !== tempId)
          )
        }
      }

      processImageInBackground() // تابع پس‌زمینه را اجرا کن

      // تابع اصلی بلافاصله return می‌شود و UI را مسدود نمی‌کند
      return
    }

    // منطق اصلی شما برای سایر انواع فایل
    setShowFilesDisplay(true)
    setUseRetrieval(true)

    let simplifiedFileType = file.type.split("/")[1]
    if (simplifiedFileType.includes("vnd.adobe.pdf")) {
      simplifiedFileType = "pdf"
    } else if (
      simplifiedFileType.includes(
        "vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ) {
      simplifiedFileType = "docx"
    }

    setNewMessageFiles(prev => [
      ...prev,
      { id: "loading", name: file.name, type: simplifiedFileType, file }
    ])

    const reader = new FileReader()

    reader.onloadend = async function () {
      try {
        const createdFile = await createFile(
          file,
          {
            user_id: profile.user_id,
            description: "",
            file_path: "",
            name: file.name,
            size: file.size,
            tokens: 0,
            type: simplifiedFileType
          },
          selectedWorkspace.id,
          chatSettings.embeddingsProvider
        )
        setFiles(prev => [...prev, createdFile])
        setNewMessageFiles(prev =>
          prev.map(item =>
            item.id === "loading" ? { ...createdFile, file: file } : item
          )
        )
      } catch (error: any) {
        toast.error(`آپلود ناموفق بود: ${error.message}`)
        setNewMessageFiles(prev => prev.filter(f => f.id !== "loading"))
      }
    }

    if (simplifiedFileType === "docx") {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        const createdFile = await createDocXFile(
          result.value,
          file,
          {
            user_id: profile.user_id,
            description: "",
            file_path: "",
            name: file.name,
            size: file.size,
            tokens: 0,
            type: "docx"
          },
          selectedWorkspace.id,
          chatSettings.embeddingsProvider
        )
        setFiles(prev => [...prev, createdFile])
        setNewMessageFiles(prev =>
          prev.map(item =>
            item.id === "loading" ? { ...createdFile, file: file } : item
          )
        )
      } catch (error: any) {
        toast.error(`پردازش فایل docx ناموفق بود: ${error.message}`)
        setNewMessageFiles(prev => prev.filter(f => f.id !== "loading"))
      }
    } else if (simplifiedFileType === "pdf") {
      try {
        // ۱. تابع خودتان را برای استخراج متن PDF فراخوانی کنید
        const pdfText = await extractPdfText(file)

        // ۲. حالا فایل را با متن استخراج شده ایجاد کنید
        // (این کد از reader.onloadend شما کپی شده و باید اینجا باشد)
        const createdFile = await createFile(
          file,
          {
            user_id: profile.user_id,
            description: pdfText, // <-- ✨ متن PDF اینجا پاس داده می‌شود
            file_path: "",
            name: file.name,
            size: file.size,
            tokens: 0,
            type: simplifiedFileType
          },
          selectedWorkspace.id,
          chatSettings.embeddingsProvider
        )
        setFiles(prev => [...prev, createdFile])
        setNewMessageFiles(prev =>
          prev.map(item =>
            item.id === "loading" ? { ...createdFile, file: file } : item
          )
        )
      } catch (error: any) {
        toast.error(`پردازش فایل PDF ناموفق بود: ${error.message}`)
        setNewMessageFiles(prev => prev.filter(f => f.id !== "loading"))
      }

      // ✅✅✅ بلوک else قبلی حالا فقط برای فایل‌های متنی است ✅✅✅
    } else {
      // این بخش برای TEXT/CSV/JSON است که باید خوانده شود
      reader.readAsText(file)
    }
  }
  return {
    handleSelectFile: handleSelectDeviceFile, // نام را برای وضوح بیشتر تغییر دادم
    filesToAccept
  }
}
