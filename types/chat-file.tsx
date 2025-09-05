export interface ChatFile {
  id: string
  name: string
  type: string
  file: File | null
  preview?: string | null // <--- این خط را اضافه کنید
  // ممکن است پراپرتی‌های دیگری هم اینجا باشد
}
