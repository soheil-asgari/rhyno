"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import OpenAI from "openai"
import { revalidatePath } from "next/cache"
import DateObject from "react-date-object"
import persian from "react-date-object/calendars/persian"
import gregorian from "react-date-object/calendars/gregorian"
import persian_fa from "react-date-object/locales/persian_fa"
import { syncToRahkaranSystem } from "@/lib/services/rahkaran"
import { sendCompletionSMS } from "@/lib/sms-service"

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://rhyno.ir",
    "X-Title": "Rhyno Automation"
  }
})

const AI_MODEL = "google/gemini-2.5-flash"

type SinglePageResult =
  | { success: true; data: any }
  | { success: false; error: string }

// ------------------------------------------------------------------
// 1. OCR Function
// ------------------------------------------------------------------

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries <= 0) throw error
    console.warn(`⚠️ Retrying... attempts left: ${retries}`)
    await new Promise(res => setTimeout(res, delay))
    return withRetry(fn, retries - 1, delay)
  }
}

function toEnglishDigits(str: string) {
  if (!str) return ""
  return str
    .toString()
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
}

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
          content: `You are an expert Data Entry Clerk. 
          Your ONLY goal is ACCURACY and COMPLETENESS.
          If there is a list of transactions, you MUST extract EVERY SINGLE ROW.
          Do not summarize. Do not skip rows.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image (Page ${pageNumber}). It contains financial transactions in Persian.

              **INSTRUCTIONS:**
              1. Identify if this is a single receipt or a list (Gardesh Hesab).
              2. **IF LIST:** Extract ALL rows presented in the table. Even if there are 10+ rows.
              3. **IF RECEIPT:** Extract the single transaction details.

              **DATA MAPPING:**
              - **Date:** (Convert to YYYY/MM/DD if possible, else keep original)
              - **Type:** - If money comes IN (واریز, انتقال به ما, +) => "Deposit"
                 - If money goes OUT (برداشت, انتقال از ما, -) => "Withdrawal"
              - **Amount:** Digits only (Rials).
              - **Party Name:** The FULL name of the person/company.
                  - ⚠️ IMPORTANT RULE: The receipt often says "به نام ... نامشخص" because the branch is unknown.
                  - You MUST extract the ACTUAL NAME before "نامشخص".
                  - Example: "به نام مرجانی بهرام نامشخص" -> Extract "مرجانی بهرام".
                  - Example: "نامشخص به نام شرکت چسب پارس" -> Extract "شرکت چسب پارس".
                  - Do NOT include the word "نامشخص" in the output name.
              - **Tracking Code:** (Shomare Peygiri / Erja)

              **JSON OUTPUT FORMAT:**
              {
                "transactions": [
                   {
                      "date": "1403/09/11",
                      "type": "Deposit",
                      "amount": 5000000,
                      "description": "Full description text",
                      "partyName": "Ali Rezaei",
                      "tracking_code": "123456"
                   }
                ]
              }
              `
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      max_tokens: 8000
    })

    if (!response.choices || response.choices.length === 0)
      throw new Error("Empty response")

    let rawContent = response.choices[0].message.content || "{}"
    rawContent = rawContent
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()

    if (!rawContent.endsWith("}")) rawContent += "}"

    const data = JSON.parse(rawContent)

    // 🛡️ لایه پاکسازی نهایی (Final Cleanup Layer) 🛡️
    // این کد اطمینان می‌دهد که حتی اگر هوش مصنوعی اشتباه کند، ما آن را اصلاح می‌کنیم
    if (data.transactions) {
      data.transactions = data.transactions.map((tx: any) => {
        let cleanName = tx.partyName || ""

        // 1. حذف کلمه "نامشخص" و "نا مشخص" از اسم
        cleanName = cleanName
          .replace(/نامشخص/g, "")
          .replace(/نا مشخص/g, "")
          .trim()

        return {
          ...tx,
          // اگر بعد از پاکسازی اسم خالی شد، برگردان به "نامشخص" (چون واقعا نامشخص بوده)
          // اگر اسم ماند (مثل "مرجانی بهرام")، همان را استفاده کن
          partyName: cleanName || "نامشخص"
        }
      })
    }

    console.log(
      `✅ Gemini Pro Extracted: ${data.transactions?.length || 0} items`
    )

    return { success: true, data }
  } catch (error: any) {
    console.error(`Page ${pageNumber} OCR Error:`, error)
    return { success: false, error: error.message }
  }
}

function getSafeDate(inputDate: string | undefined): string {
  const today = new Date().toISOString().split("T")[0]
  if (!inputDate) return today

  try {
    let cleanStr = toEnglishDigits(inputDate)
    cleanStr = cleanStr.replace(/\//g, "-")

    const dateObj = new DateObject({
      date: cleanStr,
      format: "YYYY-MM-DD",
      calendar: persian
    })

    if (dateObj.isValid) {
      const gregorianDate = dateObj.convert(gregorian)
      const year = gregorianDate.year

      if (year < 2000 || year > 2030) {
        console.warn(
          `⚠️ تاریخ نامعتبر شناسایی شد (${cleanStr} -> ${year}). استفاده از تاریخ امروز.`
        )
        return today
      }
      return gregorianDate.format("YYYY-MM-DD")
    }
  } catch (e) {
    console.error("Date Parse Error:", e)
  }
  return today
}

// ------------------------------------------------------------------
// 2. Helper Functions
// ------------------------------------------------------------------
async function findOfficerForCustomer(
  supabase: any,
  workspaceId: string,
  customerName: string
) {
  try {
    const { data: customerData } = await supabase
      .from("customer_directory")
      .select("group_name")
      .eq("workspace_id", workspaceId)
      .eq("customer_name", customerName)
      .maybeSingle()

    if (!customerData?.group_name) return null

    const { data: officerData } = await supabase
      .from("group_officers")
      .select("officer_id")
      .eq("workspace_id", workspaceId)
      .eq("group_name", customerData.group_name)
      .maybeSingle()

    return {
      officerId: officerData?.officer_id || null,
      groupName: customerData.group_name
    }
  } catch (e) {
    return null
  }
}

// ------------------------------------------------------------------
// 3. Submit Transactions (Fixed: returns IDs)
// ------------------------------------------------------------------
export async function submitGroupedTransactions(
  workspaceId: string,
  groupedData: any[]
) {
  console.log(
    `🔄 [FINANCE_ACTION] submitGroupedTransactions started. Groups: ${groupedData?.length}`
  )
  try {
    const cookieStore = cookies()
    const supabase = createClient(cookieStore)
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!groupedData || !Array.isArray(groupedData)) {
      return { success: false, error: "داده نامعتبر" }
    }

    let successCount = 0
    let errors: string[] = []
    let insertedIds: string[] = []

    console.log(`🚀 START Submitting ${groupedData.length} groups...`)

    for (const group of groupedData) {
      const transactions = Array.isArray(group.transactions)
        ? group.transactions
        : []
      let finalFileUrl = ""
      if (Array.isArray(group.fileUrl)) {
        finalFileUrl = group.fileUrl.length > 0 ? group.fileUrl[0] : ""
      } else {
        finalFileUrl = group.fileUrl || ""
      }

      for (const tx of transactions) {
        try {
          let safeAmount = tx.amount
          if (typeof tx.amount === "string") {
            safeAmount =
              parseFloat(
                toEnglishDigits(tx.amount)
                  .replace(/,/g, "")
                  .replace(/[^0-9.]/g, "")
              ) || 0
          }

          let finalSupplierName =
            tx.partyName || tx.counterparty || "تراکنش بدون نام"
          finalSupplierName = finalSupplierName
            .replace(/خانم|آقای|فروشگاه|شرکت/g, "")
            .trim()
          if (finalSupplierName.length < 2)
            finalSupplierName = tx.description || "تراکنش بدون نام"

          const finalDate = getSafeDate(tx.date)

          let assignedUserId = user?.id
          let customerGroup = "General"
          const officerInfo = await findOfficerForCustomer(
            supabase,
            workspaceId,
            finalSupplierName
          )
          if (officerInfo) {
            customerGroup = officerInfo.groupName
            if (officerInfo.officerId) assignedUserId = officerInfo.officerId
          }

          let transactionType = "withdrawal"
          if (tx.type && typeof tx.type === "string") {
            const t = tx.type.toLowerCase().trim()
            if (t === "deposit" || t === "واریز" || t.includes("dep"))
              transactionType = "deposit"
          }

          const insertData = {
            workspace_id: workspaceId,
            supplier_name: finalSupplierName,
            amount: safeAmount,
            payment_date: finalDate,
            tracking_code:
              tx.tracking_code ||
              `AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            receipt_image_url: finalFileUrl,
            description: tx.description || "",
            type: transactionType,
            counterparty: finalSupplierName,
            status: "pending_docs" as "pending_docs",
            assigned_user_id: assignedUserId || null,
            customer_group: customerGroup,
            ai_verification_status: "pending" as "pending"
          }

          const { data, error } = await supabase
            .from("payment_requests")
            .upsert(insertData, {
              onConflict: "tracking_code",
              ignoreDuplicates: true
            })
            .select("id")
            .maybeSingle()

          if (error) throw error

          if (data) {
            insertedIds.push(data.id)
            successCount++
          }
        } catch (err: any) {
          console.error("Tx Error:", err.message)
          errors.push(err.message)
        }
      }
    }

    console.log(
      `✅ [FINANCE_ACTION] submitGroupedTransactions finished. Inserted: ${insertedIds.length}`
    )

    return {
      success: true,
      count: successCount,
      ids: insertedIds,
      error: errors.length > 0 ? errors[0] : undefined
    }
  } catch (FATAL: any) {
    console.error("🔥 FATAL:", FATAL)
    return { success: false, count: 0, ids: [], error: FATAL.message }
  }
}

// در فایل app/actions/finance-actions.ts

// در فایل app/actions/finance-actions.ts

export async function submitDailyVoucher(
  date: string,
  workspaceId: string,
  type: "deposit" | "withdrawal"
) {
  console.log(
    `🔄 [FINANCE_ACTION] submitDailyVoucher called. Input Date: ${date}, Type: ${type}`
  )
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    // ✅ اصلاح مهم: تبدیل تاریخ ورودی (که احتمالا شمسی است) به میلادی
    // چون در دیتابیس تاریخ‌ها میلادی ذخیره شده‌اند
    const searchDate = getSafeDate(date)
    console.log(`📅 Converting date for search: ${date} -> ${searchDate}`)

    // 1. دریافت داده‌ها با تاریخ اصلاح شده
    const { data: requests } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("payment_date", searchDate) // <--- استفاده از تاریخ میلادی
      .eq("type", type)
      .is("rahkaran_doc_id", null)

    if (!requests || requests.length === 0) {
      console.warn(
        `⚠️ [FINANCE_ACTION] No requests found for date ${searchDate} (Input: ${date})`
      )
      return { success: false, error: `تراکنشی برای تاریخ ${date} یافت نشد.` }
    }

    // 2. آماده‌سازی داده خام
    const totalAmount = requests.reduce((sum, r) => sum + Number(r.amount), 0)
    const typeFarsi = type === "deposit" ? "واریز" : "برداشت"

    const payload = {
      description: `سند تجمیعی ${typeFarsi} - مورخ ${date}`, // در شرح سند همان شمسی را می‌نویسیم که خوانا باشد
      mode: type,
      totalAmount: totalAmount,
      date: searchDate, // برای تاریخ سند در راهکاران، میلادی می‌فرستیم (سیستم خودش هندل می‌کند)
      items: requests.map(r => ({
        partyName: r.counterparty || r.supplier_name || "نامشخص",
        amount: Number(r.amount),
        desc: r.description || `${typeFarsi} وجه`,
        tracking: r.tracking_code || ""
      }))
    }

    console.log(
      "📤 [FINANCE_ACTION] Sending Payload to Rahkaran:",
      JSON.stringify(payload, null, 2)
    )

    // 3. ارسال به تابع هوشمند
    const rahkaranRes = await syncToRahkaranSystem(payload)

    if (!rahkaranRes.success) throw new Error(rahkaranRes.error)

    // 4. آپدیت دیتابیس
    const requestIds = requests.map(r => r.id)
    await supabase
      .from("payment_requests")
      .update({
        status: "completed",
        rahkaran_doc_id: rahkaranRes.docId,
        ai_verification_reason: `سند تجمیعی: ${rahkaranRes.docId}`
      })
      .in("id", requestIds)

    return {
      success: true,
      docId: rahkaranRes.docId,
      count: requests.length,
      totalAmount: totalAmount,
      // مقادیر برگشتی برای نمایش رسید
      party: "سند تجمیعی",
      sl: "---"
    }
  } catch (e: any) {
    console.error("❌ [DAILY VOUCHER ERROR]:", e.message)
    return { success: false, error: e.message }
  }
}
// ------------------------------------------------------------------
// 4. Verify & Settle
// ------------------------------------------------------------------
// ... (other imports and code above)

// ------------------------------------------------------------------
// 4. Verify & Settle
// ------------------------------------------------------------------
export async function verifyAndSettleRequest(
  requestId: string,
  workspaceId: string,
  invoiceUrl: string,
  warehouseUrl: string
) {
  console.log(
    `🔄 [FINANCE_ACTION] verifyAndSettleRequest called for ID: ${requestId}`
  )
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { data: request } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", requestId)
      .single()

    if (!request) throw new Error("رکورد پیدا نشد")

    // --- بخش AI Audit ---
    // (اینجا کد audit شما می‌تواند فعال باشد)

    const partyName = request.counterparty || request.supplier_name || "نامشخص"
    const safeAmount = Number(request.amount) || 0
    const typeFarsi = request.type === "deposit" ? "واریز" : "برداشت"
    const docDescription = `سند سیستمی ${typeFarsi} وجه - کد رهگیری: ${request.tracking_code || "---"}`
    const safeDate =
      request.payment_date || new Date().toISOString().split("T")[0]
    const rawItems = [
      {
        partyName: partyName,
        amount: safeAmount,
        desc: request.description || "",
        tracking: request.tracking_code || ""
      }
    ]

    console.log(
      "📤 [FINANCE_ACTION] Sending Single Transaction Payload to Rahkaran:",
      JSON.stringify(
        {
          mode: request.type === "deposit" ? "deposit" : "withdrawal",
          description: docDescription,
          totalAmount: safeAmount,
          items: rawItems
        },
        null,
        2
      )
    )

    // Call the sync function (Rahkaran Proxy)
    const rahkaranRes = await withRetry(
      async () => {
        console.log("🔄 Connecting to Rahkaran Proxy...")
        return await syncToRahkaranSystem({
          mode: request.type === "deposit" ? "deposit" : "withdrawal",
          description: docDescription,
          totalAmount: safeAmount,
          items: rawItems,
          date: safeDate
        })
      },
      3,
      2000
    )

    console.log(
      "📥 [FINANCE_ACTION] Response from Rahkaran (Single):",
      rahkaranRes
    )

    if (!rahkaranRes.success)
      throw new Error(`Rahkaran Proxy Error: ${rahkaranRes.error}`)

    // Update Supabase record
    await supabase
      .from("payment_requests")
      .update({
        invoice_url: invoiceUrl,
        warehouse_receipt_url: warehouseUrl,
        ai_verification_status: "approved",
        status: "completed",
        rahkaran_doc_id: rahkaranRes.docId,
        ai_verification_reason: `ثبت شد: ${rahkaranRes.docId}`
      })
      .eq("id", requestId)

    console.log("✅ [FINANCE_ACTION] Request successfully settled.")

    // ✅ Correction: Return full details for UI
    return {
      success: true,
      approved: true,
      reason: rahkaranRes.docId,
      docId: rahkaranRes.docId, // Explicitly return docId
      party: rahkaranRes.party, // Return the party name found by SQL
      sl: rahkaranRes.sl // Return the SL code found by SQL
    }
  } catch (error: any) {
    console.error("❌ [FINANCE_ACTION] Verify/Settle Error:", error.message)
    // Log detailed error for debugging
    if (error.message.includes("Rahkaran Proxy Error")) {
      console.error("Detailed Proxy Error:", JSON.stringify(error, null, 2))
    }
    return { success: false, error: error.message }
  }
}

// ... (rest of the code)

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
        invoice_url: invoiceUrl,
        warehouse_receipt_url: warehouseUrl,
        ai_verification_status: "approved"
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId)

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error("Manual Completion Error:", error)
    return { success: false, error: error.message }
  }
}

export async function addRequestNote(requestId: string, noteText: string) {
  const proxyUrl = process.env.RAHKARAN_PROXY_URL
  const proxyKey = process.env.RAHKARAN_PROXY_KEY

  const sqlQuery = `
        INSERT INTO RequestNotes (
            RequestId, 
            NoteText, 
            DateAdded
        )
        VALUES (
            '${requestId}', 
            N'${noteText}', 
            GETDATE()
        )
    `

  if (!proxyUrl || !proxyKey) {
    return { success: false, error: "Proxy configuration is missing." }
  }

  try {
    const response = await withRetry(async () => {
      return await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-proxy-key": proxyKey
        },
        body: JSON.stringify({ query: sqlQuery })
      })
    })

    const data = await response.json()
    if (response.ok && data.success === true)
      return { success: true, message: "Saved." }
    return { success: false, error: data.error }
  } catch (error) {
    return { success: false, error: "Connection failed." }
  }
}
