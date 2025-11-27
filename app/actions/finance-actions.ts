"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import OpenAI from "openai"
import { revalidatePath } from "next/cache"
import DateObject from "react-date-object"
import persian from "react-date-object/calendars/persian"
import gregorian from "react-date-object/calendars/gregorian"
import persian_fa from "react-date-object/locales/persian_fa"

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://rhyno.ir",
    "X-Title": "Rhyno Automation"
  }
})

// مدل انتخابی شما (بسیار سریع و دقیق)
const AI_MODEL = "google/gemini-2.5-flash"

type SinglePageResult =
  | { success: true; data: any }
  | { success: false; error: string }

export async function analyzeSinglePage(
  imageUrl: string,
  pageNumber: number,
  pageText: string = ""
): Promise<SinglePageResult> {
  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert accounting data extractor. Your goal is to extract structured transaction data, specifically identifying the 'Counterparty' (beneficiary or payer) from descriptions."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `این تصویر و متن مربوط به صفحه ${pageNumber} صورتحساب بانکی است. جدول تراکنش‌ها را استخراج کن.
              
              متن کمکی استخراج شده:
              """
              ${pageText}
              """

              دستورالعمل‌های حیاتی:
              1. **استخراج طرف حساب (Counterparty):** این مهمترین بخش است. متن "شرح" را تحلیل کن و ببین تراکنش مربوط به چه کسی یا چه بابتی است.
                 - دنبال کلماتی مثل "به نام"، "در وجه"، "از طرف"، "واریز توسط"، "بابت"، "حواله به"، "پایا به" بگرد.
                 - نام شخص، شرکت یا دلیل پرداخت را در فیلد 'counterparty' قرار بده.
                 - اگر پیدا نکردی، بخشی از توضیحات که مهم است را بگذار.
              
              2. **نوع تراکنش:**
                 - اگر در ستون بدهکار/برداشت عدد بود: 'withdrawal'
                 - اگر در ستون بستانکار/واریز عدد بود: 'deposit'

              3. **فرمت خروجی (JSON Only):**
              {
                "bank_name": "نام بانک",
                "account_number": "شماره حساب",
                "transactions": [
                   { 
                     "date": "YYYY/MM/DD", 
                     "type": "deposit" | "withdrawal", 
                     "amount": عدد_بدون_ویرگول, 
                     "description": "متن کامل شرح",
                     "counterparty": "نام طرف حساب یا بابت شناسایی شده", 
                     "tracking_code": "شماره پیگیری" 
                   }
                ]
              }`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      temperature: 0,
      max_tokens: 4000
    })

    if (!response.choices || response.choices.length === 0)
      throw new Error("Empty response")

    let rawContent = response.choices[0].message.content || "{}"
    rawContent = rawContent
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()

    let data
    try {
      data = JSON.parse(rawContent)
    } catch (e) {
      try {
        if (!rawContent.endsWith("}")) {
          rawContent += '"}]}'
          data = JSON.parse(rawContent)
        } else {
          throw e
        }
      } catch (e2) {
        console.error("JSON Parse Error:", rawContent)
        return { success: false, error: "خطا در فرمت خروجی" }
      }
    }

    return { success: true, data }
  } catch (error: any) {
    console.error(`Page ${pageNumber} Error:`, error)
    return { success: false, error: error.message || "خطای ناشناخته" }
  }
}

// این تابع را در فایل finance-actions.ts جایگزین تابع قبلی کنید

export async function submitGroupedTransactions(
  workspaceId: string,
  groupedData: any[]
) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  let successCount = 0
  let errors = []

  console.log("🚀 START Submitting Transactions...") // لاگ شروع

  for (const group of groupedData) {
    const transactions = Array.isArray(group.transactions)
      ? group.transactions
      : []

    // --- اصلاح ۱: هندل کردن عکس (آرایه به رشته) ---
    let finalFileUrl = group.fileUrl
    if (Array.isArray(group.fileUrl)) {
      finalFileUrl = group.fileUrl.length > 0 ? group.fileUrl[0] : null
    }

    for (const tx of transactions) {
      try {
        // 1. تمیزکاری مبلغ
        let safeAmount = tx.amount
        if (typeof tx.amount === "string") {
          safeAmount =
            parseFloat(
              tx.amount.replace(/,/g, "").replace(/ریال/g, "").trim()
            ) || 0
        }

        // 2. تعیین نام طرف حساب
        const finalSupplierName =
          tx.counterparty && tx.counterparty.length > 2
            ? tx.counterparty
            : tx.description || "تراکنش بدون نام"

        // 3. اصلاح تاریخ
        let finalDate = null
        try {
          if (tx.date) {
            const dateObj = new DateObject({
              date: tx.date,
              format: "YYYY/MM/DD",
              calendar: persian,
              locale: persian_fa
            })
            finalDate = dateObj.convert(gregorian).format("YYYY-MM-DD")
          }
        } catch (e) {
          console.log("Date warning, using today")
          finalDate = new Date().toISOString().split("T")[0]
        }

        console.log(`📝 Inserting: ${finalSupplierName} - ${safeAmount}`)

        // 4. اینسرت در دیتابیس
        const { error } = await supabase.from("payment_requests").insert({
          workspace_id: workspaceId,
          supplier_name: finalSupplierName,
          amount: safeAmount,
          payment_date: finalDate,
          tracking_code: tx.tracking_code,

          // استفاده از URL اصلاح شده (حتما رشته باشد)
          receipt_image_url: finalFileUrl,

          description: tx.description,
          type: tx.type,
          counterparty: tx.counterparty,
          status: "pending_docs"
        })

        if (error) {
          console.error("❌ DB Insert Error:", error) // این را در ترمینال ببینید
          throw error
        }

        successCount++
      } catch (err: any) {
        console.error("❌ Transaction Loop Error:", err.message)
        errors.push(err.message)
      }
    }
  }

  revalidatePath(`/enterprise/${workspaceId}/finance/documents`)

  console.log(`🏁 Finished: ${successCount} success, ${errors.length} errors`)

  if (errors.length > 0) {
    return { success: false, count: successCount, error: errors[0] }
  }

  return { success: true, count: successCount }
}

// این تابع را جایگزین completeRequestDocs قبلی کنید
export async function completeRequestDocs(
  id: string,
  workspaceId: string,
  invoiceUrl: string,
  warehouseUrl: string
) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { error } = await supabase
      .from("payment_requests")
      .update({
        status: "completed",
        // فرض بر این است که این ستون‌ها را در دیتابیس دارید
        // اگر ندارید، باید در Supabase اضافه کنید یا نامشان را اصلاح کنید
        invoice_url: invoiceUrl,
        warehouse_receipt_url: warehouseUrl
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId)

    if (error) throw error

    revalidatePath(`/enterprise/${workspaceId}/finance/documents`)
    return { success: true }
  } catch (error: any) {
    console.error("Update Error:", error)
    return { success: false, error: error.message }
  }
}
