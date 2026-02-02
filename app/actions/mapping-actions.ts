"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import * as XLSX from "xlsx"
import { revalidatePath } from "next/cache"

// تابع کمکی برای تبدیل اعداد فارسی به انگلیسی
function toEnglishDigits(str: string) {
  if (!str) return ""
  return str
    .toString()
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
}

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

    const records = jsonData
      .map(row => {
        const getVal = (key: string) => {
          const foundKey = Object.keys(row).find(
            k => k.toLowerCase().trim() === key.toLowerCase()
          )
          return foundKey ? row[foundKey] : null
        }

        const customerName =
          getVal("customer") ||
          getVal("customer name") ||
          getVal("مشتری") ||
          getVal("نام مشتری")

        const officerEmail =
          getVal("officer") ||
          getVal("officer email") ||
          getVal("email") ||
          getVal("مسئول") ||
          getVal("ایمیل مسئول")

        // ✅ خواندن ستون شماره موبایل
        let officerPhone =
          getVal("phone") ||
          getVal("mobile") ||
          getVal("cellphone") ||
          getVal("تلفن") ||
          getVal("موبایل") ||
          getVal("شماره") ||
          getVal("شماره تماس")

        // تمیزکاری شماره موبایل (فقط اعداد بمانند)
        if (officerPhone) {
          officerPhone = toEnglishDigits(String(officerPhone)).replace(
            /[^0-9]/g,
            ""
          )
          // اگر با 9 شروع می‌شود، یک 0 به اولش اضافه کن
          if (officerPhone.startsWith("9")) officerPhone = "0" + officerPhone
        }

        if (!customerName || !officerEmail) return null

        return {
          workspace_id: workspaceId,
          customer_name: String(customerName).trim(),
          officer_email: String(officerEmail).trim().toLowerCase(),
          officer_phone: officerPhone || null, // ✅ ذخیره موبایل
          group_name: "Imported"
        }
      })
      .filter(r => r !== null)

    if (records.length === 0) throw new Error("هیچ رکورد معتبری یافت نشد.")

    const { error } = await supabase
      .from("customer_mappings")
      .upsert(records, { onConflict: "workspace_id,customer_name" })

    if (error) {
      console.error("Database Error:", error)
      throw new Error("خطا در ذخیره‌سازی در دیتابیس")
    }

    revalidatePath(`/enterprise/${workspaceId}/finance/customers`)
    return { success: true, count: records.length }
  } catch (error: any) {
    console.error("Upload Excel Error:", error)
    return { success: false, error: error.message }
  }
}
