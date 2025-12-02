"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import * as XLSX from "xlsx"
import { revalidatePath } from "next/cache"

// 1. Upload Excel
export async function uploadCustomerExcel(
  workspaceId: string,
  formData: FormData
) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const file = formData.get("file") as File
    if (!file) throw new Error("فایل یافت نشد")

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(sheet) as any[]

    // Normalize keys (lowercase, trim) to handle "Customer" vs "customer"
    const records = jsonData
      .map(row => {
        // Find keys regardless of case
        const getVal = (key: string) =>
          row[
            Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase()) ||
              ""
          ]

        return {
          workspace_id: workspaceId,
          customer_name:
            getVal("customer") || getVal("مشتری") || getVal("name"),
          group_name: getVal("group") || getVal("گروه") || "General"
        }
      })
      .filter(r => r.customer_name)

    if (records.length === 0) throw new Error("رکوردی یافت نشد")

    const { error } = await supabase
      .from("customer_directory")
      .upsert(records, { onConflict: "workspace_id,customer_name" })

    if (error) throw error

    revalidatePath(`/enterprise/${workspaceId}/finance/settings`)
    return { success: true, count: records.length }
  } catch (error: any) {
    console.error("Upload Error:", error)
    return { success: false, error: error.message }
  }
}

// 2. Get Groups
export async function getGroupsAndOfficers(workspaceId: string) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data: groups } = await supabase
    .from("customer_directory")
    .select("group_name")
    .eq("workspace_id", workspaceId)
  const { data: officers } = await supabase
    .from("group_officers")
    .select("group_name, officer_id")
    .eq("workspace_id", workspaceId)

  const uniqueGroups = Array.from(new Set(groups?.map(g => g.group_name) || []))

  return uniqueGroups.map(gName => ({
    name: gName,
    assignedOfficerId:
      officers?.find(o => o.group_name === gName)?.officer_id || null
  }))
}

// 3. Assign Officer
export async function assignOfficerToGroup(
  workspaceId: string,
  groupName: string,
  officerId: string
) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.from("group_officers").upsert(
    {
      workspace_id: workspaceId,
      group_name: groupName,
      officer_id: officerId
    },
    { onConflict: "workspace_id,group_name" }
  )

  if (error) return { success: false, error: error.message }

  revalidatePath(`/enterprise/${workspaceId}/finance/settings`)
  return { success: true }
}
