// lib/upload-helper.ts
import { supabase } from "@/lib/supabase/client"

export async function uploadToSupabase(
  file: File,
  bucket: string = "finance_docs"
) {
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file)

  if (error) {
    throw new Error("Upload failed: " + error.message)
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName)

  return publicUrlData.publicUrl
}
