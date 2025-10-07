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
    if (isImage) {
      const model = LLM_LIST.find(llm => llm.modelId === chatSettings.model)
      if (!model?.imageInput) {
        toast.error(`مدل فعلی از ورودی تصویر پشتیبانی نمی‌کند.`)
        return
      }

      // گزینه‌های فشرده‌سازی
      const options = {
        maxSizeMB: 1, // حداکثر حجم فایل بعد از فشرده‌سازی (مثلاً ۱ مگابایت)
        maxWidthOrHeight: 1024, // حداکثر عرض یا ارتفاع
        useWebWorker: true // برای جلوگیری از هنگ کردن در حین فشرده‌سازی
      }

      const compressingPromise = imageCompression(file, options)

      // toast.promise(compressingPromise, {
      //   loading: "در حال فشرده‌سازی عکس...",
      //   success: "عکس با موفقیت فشرده شد!",
      //   error: "فشرده‌سازی ناموفق بود."
      // });

      try {
        const compressedFile = await compressingPromise

        // حالا فایل فشرده شده را به Base64 تبدیل می‌کنیم
        const reader = new FileReader()
        reader.readAsDataURL(compressedFile)
        reader.onloadend = () => {
          setNewMessageImages(prev => [
            ...prev,
            {
              messageId: "temp",
              path: "",
              base64: reader.result as string, // نتیجه Base64
              url: URL.createObjectURL(compressedFile), // URL محلی برای پیش‌نمایش
              file: compressedFile
            }
          ])
        }
        setShowFilesDisplay(true)
      } catch (error) {
        console.error("Image compression error:", error)
        toast.error("خطا در هنگام فشرده‌سازی عکس.")
      }

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
    } else {
      file.type.includes("pdf")
        ? reader.readAsArrayBuffer(file)
        : reader.readAsText(file)
    }
  }
  return {
    handleSelectFile: handleSelectDeviceFile, // نام را برای وضوح بیشتر تغییر دادم
    filesToAccept
  }
}
