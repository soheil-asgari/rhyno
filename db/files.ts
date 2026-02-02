import { supabase } from "@/lib/supabase/browser-client"
import { TablesInsert, TablesUpdate } from "@/supabase/types"
import mammoth from "mammoth"
import { toast } from "sonner"
import { uploadFile } from "./storage/files"

export const getFileById = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

export const getFileWorkspacesByWorkspaceId = async (workspaceId: string) => {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select(
      `
      id,
      name,
      files (*)
    `
    )
    .eq("id", workspaceId)
    .single()

  if (!workspace) {
    throw new Error(error.message)
  }

  return workspace
}

export const getFileWorkspacesByFileId = async (fileId: string) => {
  const { data: file, error } = await supabase
    .from("files")
    .select(
      `
      id, 
      name, 
      workspaces (*)
    `
    )
    .eq("id", fileId)
    .single()

  if (!file) {
    throw new Error(error.message)
  }

  return file
}

export const createFileBasedOnExtension = async (
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "openai" | "local"
) => {
  const fileExtension = file.name.split(".").pop()

  if (fileExtension === "docx") {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({
      arrayBuffer
    })

    return createDocXFile(
      result.value,
      file,
      fileRecord,
      workspace_id,
      embeddingsProvider
    )
  } else {
    return createFile(file, fileRecord, workspace_id, embeddingsProvider)
  }
}

// تابع کمکی برای لاگ و اصلاح داده‌ها
const prepareFileForInsert = (
  record: TablesInsert<"files">,
  fileName: string
) => {
  console.log("--- [DEBUG] Raw Input Record:", record)

  const safeRecord = { ...record }

  // بررسی دقیق description
  let description = safeRecord.description

  // اگر نال، آندیفایند یا رشته خالی بود
  if (
    !description ||
    typeof description !== "string" ||
    description.trim().length === 0
  ) {
    console.log("--- [DEBUG] Description was empty/invalid. Fixing...")
    // استفاده از نام فایل یا یک متن ثابت اگر نام فایل هم مشکل داشت
    description = fileName || "Attachment"
  }

  // اطمینان نهایی از اینکه رشته خالی نیست
  if (description.trim().length === 0) {
    description = "File Attachment"
  }

  safeRecord.description = description

  console.log("--- [DEBUG] Final Record to Insert:", safeRecord)
  return safeRecord
}

// For non-docx files
export const createFile = async (
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "openai" | "local"
) => {
  let validFilename = fileRecord.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase()
  const extension = file.name.split(".").pop()
  const extensionIndex = validFilename.lastIndexOf(".")
  const baseName = validFilename.substring(
    0,
    extensionIndex < 0 ? undefined : extensionIndex
  )
  const maxBaseNameLength = 100 - (extension?.length || 0) - 1
  if (baseName.length > maxBaseNameLength) {
    fileRecord.name = baseName.substring(0, maxBaseNameLength) + "." + extension
  } else {
    fileRecord.name = baseName + "." + extension
  }

  // ✅ استفاده از تابع کمکی با لاگ
  const fileToInsert = prepareFileForInsert(fileRecord, fileRecord.name)

  const { data: createdFile, error } = await supabase
    .from("files")
    .insert([fileToInsert])
    .select("*")
    .single()

  if (error) {
    console.error("❌ [DEBUG] Supabase Insert Error:", error)
    console.error("❌ [DEBUG] Failed Payload:", fileToInsert)
    throw new Error(error.message)
  }

  await createFileWorkspace({
    user_id: createdFile.user_id,
    file_id: createdFile.id,
    workspace_id
  })

  const filePath = await uploadFile(file, {
    name: createdFile.name,
    user_id: createdFile.user_id,
    file_id: createdFile.name
  })

  await updateFile(createdFile.id, { file_path: filePath })

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    toast.error("Authentication error — please log in again.")
    throw new Error("User not authenticated")
  }

  const token = session.access_token

  const formData = new FormData()
  formData.append("file_id", createdFile.id)
  formData.append("embeddingsProvider", embeddingsProvider)

  const response = await fetch("/api/retrieval/process", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  })

  if (!response.ok) {
    const jsonText = await response.text()
    let json
    try {
      json = JSON.parse(jsonText)
    } catch {
      json = { message: jsonText }
    }

    console.error(
      `Error processing file:${createdFile.id}, status:${response.status}, response:${json.message}`
    )
    toast.error("Failed to process file. Reason: " + json.message, {
      duration: 10000
    })
    await deleteFile(createdFile.id)
  }

  return await getFileById(createdFile.id)
}

// // Handle docx files
export const createDocXFile = async (
  text: string,
  file: File,
  fileRecord: TablesInsert<"files">,
  workspace_id: string,
  embeddingsProvider: "openai" | "local"
) => {
  // ✅ استفاده از تابع کمکی با لاگ
  const fileToInsert = prepareFileForInsert(fileRecord, fileRecord.name)

  const { data: createdFile, error } = await supabase
    .from("files")
    .insert([fileToInsert])
    .select("*")
    .single()

  if (error) {
    console.error("❌ [DEBUG] Supabase Insert DocX Error:", error)
    throw new Error(error.message)
  }

  await createFileWorkspace({
    user_id: createdFile.user_id,
    file_id: createdFile.id,
    workspace_id
  })

  const filePath = await uploadFile(file, {
    name: createdFile.name,
    user_id: createdFile.user_id,
    file_id: createdFile.name
  })

  await updateFile(createdFile.id, { file_path: filePath })

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    toast.error("Authentication error — please log in again.")
    throw new Error("User not authenticated")
  }

  const token = session.access_token

  const response = await fetch("/api/retrieval/process/docx", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      text,
      fileId: createdFile.id,
      embeddingsProvider,
      fileExtension: "docx"
    })
  })

  if (!response.ok) {
    const jsonText = await response.text()
    let json
    try {
      json = JSON.parse(jsonText)
    } catch {
      json = { message: jsonText }
    }

    console.error(
      `Error processing file:${createdFile.id}, status:${response.status}, response:${json.message}`
    )
    toast.error("Failed to process file. Reason: " + json.message, {
      duration: 10000
    })
    await deleteFile(createdFile.id)
  }

  return await getFileById(createdFile.id)
}

export const createFiles = async (
  files: TablesInsert<"files">[],
  workspace_id: string
) => {
  // ✅ لاگ و اصلاح گروهی
  console.log("--- [DEBUG] Bulk Create Files Input:", files)

  const safeFiles = files.map(f => prepareFileForInsert(f, f.name))

  const { data: createdFiles, error } = await supabase
    .from("files")
    .insert(safeFiles)
    .select("*")

  if (error) {
    console.error("❌ [DEBUG] Supabase Bulk Insert Error:", error)
    throw new Error(error.message)
  }

  await createFileWorkspaces(
    createdFiles.map(file => ({
      user_id: file.user_id,
      file_id: file.id,
      workspace_id
    }))
  )

  return createdFiles
}

export const createFileWorkspace = async (item: {
  user_id: string
  file_id: string
  workspace_id: string
}) => {
  const { data: createdFileWorkspace, error } = await supabase
    .from("file_workspaces")
    .insert([item])
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdFileWorkspace
}

export const createFileWorkspaces = async (
  items: { user_id: string; file_id: string; workspace_id: string }[]
) => {
  const { data: createdFileWorkspaces, error } = await supabase
    .from("file_workspaces")
    .insert(items)
    .select("*")

  if (error) throw new Error(error.message)

  return createdFileWorkspaces
}

export const updateFile = async (
  fileId: string,
  file: TablesUpdate<"files">
) => {
  const { data: updatedFile, error } = await supabase
    .from("files")
    .update(file)
    .eq("id", fileId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return updatedFile
}

export const deleteFile = async (fileId: string) => {
  const { error } = await supabase.from("files").delete().eq("id", fileId)

  if (error) {
    throw new Error(error.message)
  }

  return true
}

export const deleteFileWorkspace = async (
  fileId: string,
  workspaceId: string
) => {
  const { error } = await supabase
    .from("file_workspaces")
    .delete()
    .eq("file_id", fileId)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)

  return true
}
