import { supabase } from "@/lib/supabase/browser-client" // مسیر supabase client خود را وارد کنید
import { Tables } from "@/supabase/types"

// این تابع فایل خام را می‌گیرد و در باکت شما آپلود می‌کند
export const uploadFile = async (
  file: File,
  metadata: {
    user_id: string
    workspace_id: string
  }
) => {
  // نام باکت خود در سوپابیس را جایگزین 'file_bucket' کنید
  const bucket = "files"

  // یک مسیر یکتا برای فایل ایجاد می‌کنیم تا با فایل‌های دیگر تداخل نداشته باشد
  const fileExtension = file.name.split(".").pop()
  const filePath = `${metadata.user_id}/${metadata.workspace_id}/${crypto.randomUUID()}.${fileExtension}`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file)

  if (error) {
    throw new Error(`خطا در آپلود فایل: ${error.message}`)
  }

  return data.path // مسیر فایل آپلود شده را برمی‌گردانیم
}
