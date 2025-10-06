import { ChatbotUIContext } from "@/context/context"
import { createDocXFile, createFile } from "@/db/files"
import { LLM_LIST } from "@/lib/models/llm/llm-list"
import mammoth from "mammoth"
import { useContext, useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase/client"
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
    selectedChat,
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
    if (!profile || !selectedWorkspace || !chatSettings || !selectedChat) {
      toast.error("لطفاً ابتدا یک چت را انتخاب کنید.")
      return
    }
    // --- مرحله ۱: اعتبارسنجی فایل ---
    const isImage = file.type.startsWith("image/")
    const isAudio = file.type.startsWith("audio/")
    const isAcceptedDoc = ACCEPTED_FILE_TYPES.split(",").includes(file.type)

    if (!isImage && !isAudio && !isAcceptedDoc) {
      toast.error(`فرمت فایل پشتیبانی نمی‌شود: ${file.type}`)
      return
    }

    if (isImage) {
      const model = LLM_LIST.find(llm => llm.modelId === chatSettings.model)
      if (!model?.imageInput) {
        toast.error(
          `مدل فعلی (${model?.modelName || chatSettings.model}) از ورودی تصویر پشتیبانی نمی‌کند.`
        )
        return
      }
    }

    // --- مرحله ۲: پردازش فایل پس از اعتبارسنجی موفق ---
    setShowFilesDisplay(true)
    setUseRetrieval(true)
    if (isImage) {
      // برای نمایش سریع یک پیش‌نمایش در UI
      const localImageUrl = URL.createObjectURL(file)
      setNewMessageImages(prev => [
        ...prev,
        {
          messageId: "uploading", // یک شناسه موقت برای حالت آپلود
          path: "",
          base64: null, // دیگر نیازی به Base64 نداریم
          url: localImageUrl, // URL محلی برای پیش‌نمایش
          file
        }
      ])

      try {
        // ۱. ساخت مسیر یکتا برای فایل در Storage
        // این مسیر با قوانینی که در Supabase تعریف کردیم هماهنگ است
        const fileExt = file.name.split(".").pop()
        const filePath = `${profile.user_id}/${Date.now()}.${fileExt}`

        // ۲. آپلود مستقیم فایل به Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("message_files") // نام باکت شما
          .upload(filePath, file)

        if (uploadError) {
          throw uploadError
        }

        // ۳. دریافت URL عمومی و دائمی فایل
        const {
          data: { publicUrl }
        } = supabase.storage.from("message_files").getPublicUrl(filePath)

        const { data: lastMessageData, error: lastMessageError } =
          await supabase
            .from("messages")
            .select("sequence_number")
            .eq("chat_id", selectedChat.id) // selectedChat در اینجا دیگر null نیست
            .order("sequence_number", { ascending: false })
            .limit(1)
            .single() // برای دریافت فقط یک آبجکت یا null

        // اگر خطایی غیر از "پیدا نشدن ردیف" رخ داد، آن را نمایش بده
        if (lastMessageError && lastMessageError.code !== "PGRST116") {
          throw lastMessageError
        }
        const newSequenceNumber = lastMessageData
          ? lastMessageData.sequence_number + 1
          : 1
        // ۴. (اختیاری ولی پیشنهادی) ذخیره URL در دیتابیس
        // فرض می‌کنیم جدولی به نام `messages` با ستونی به نام `file_url` دارید
        const { error: dbError } = await supabase.from("messages").insert({
          // --- مقادیر اجباری که باید اضافه شوند ---
          chat_id: selectedChat.id, // یا هر متغیری که ID چت فعلی را نگه می‌دارد
          content: "", // اگر پیام متنی همراه عکس نیست، یک رشته خالی بگذارید
          model: chatSettings.model, // مدلی که در حال استفاده است
          role: "user", // نقش کاربری که پیام را ارسال می‌کند
          image_paths: [], // اگر از این ستون استفاده نمی‌کنید، یک آرایه خالی بگذارید
          sequence_number: newSequenceNumber, // باید شماره ترتیب پیام را محاسبه کنید

          // --- مقادیری که از قبل داشتید و صحیح بودند ---
          user_id: profile.user_id,
          file_url: publicUrl
        })

        if (dbError) {
          throw new Error("خطا در ذخیره آدرس فایل در دیتابیس.")
        }

        // ۵. آپدیت UI با URL نهایی و دائمی
        setNewMessageImages(prev =>
          prev.map(img =>
            img.messageId === "uploading"
              ? { ...img, messageId: "temp", url: publicUrl, path: filePath }
              : img
          )
        )
        toast.success("عکس با موفقیت آپلود شد!")
      } catch (error: any) {
        toast.error(`آپلود ناموفق بود: ${error.message}`)
        // حذف پیش‌نمایش در صورت خطا
        setNewMessageImages(prev =>
          prev.filter(img => img.messageId !== "uploading")
        )
      }
      return // پردازش تصویر اینجا تمام می‌شود
    }
    const reader = new FileReader()

    if (isImage) {
      reader.readAsDataURL(file)
      reader.onloadend = () => {
        const imageUrl = URL.createObjectURL(file)
        setNewMessageImages(prev => [
          ...prev,
          {
            messageId: "temp",
            path: "",
            base64: reader.result,
            url: imageUrl,
            file
          }
        ])
      }
      return // پردازش تصویر اینجا تمام می‌شود
    }

    // پردازش برای سایر فایل‌ها (صوتی، اسناد و ...)
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

    // مدیریت خاص برای فایل‌های DOCX با mammoth
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
      // خواندن فایل برای سایر انواع (PDF, CSV, ...)
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
