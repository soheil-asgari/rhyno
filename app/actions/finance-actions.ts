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

const PROXY_URL = process.env.RAHKARAN_PROXY_URL
const PROXY_KEY = process.env.RAHKARAN_PROXY_KEY

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
      model: AI_MODEL, // gemini-2.5-flash
      messages: [
        {
          role: "system",
          content: `You are an expert OCR engine for Persian Banking Documents.
          Your goal is to extract EVERY SINGLE transaction row with 100% precision.
          
          CRITICAL RULES:
          1. **Detached Numbers:** Sometimes text and numbers are glued together (e.g., "عددی49,000"). You MUST split them (e.g., Description: "عددی", Amount: 49000).
          2. **Unknown Names:** If a name is "نامشخص", look at the description. Often the real name is hidden there (e.g. "به نام علی رضایی"). Extract the REAL name.
          3. **Full List:** Do not stop after 5 items. If there are 50 items, extract 50 items.
          4. **Amount:** Always convert Rials to integer. Remove commas.
          `
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract data from this image (Page ${pageNumber}).

              **SPECIFIC INSTRUCTIONS FOR THIS DOCUMENT:**
              - Look for rows with date, amount, and description.
              - **Party Name:** Extract the name of the sender/receiver.
                 - If the column says "نامشخص" or "Unknown", search the 'Description' (شرح) column for text like "به نام ..." or "بنام ...".
                 - Example: Column="نامشخص", Desc="پایا به نام شرکت فولاد" => Party Name = "شرکت فولاد".
              
              - **Amounts:** - Watch out for glued text! 
                 - "مبلغ: 49,000" is easy.
                 - "مانده49,000" => Amount is 49000.
                 - "سهیل عددی49,252,796,116" => Amount is 49252796116.
              
              - **Output JSON:**
              {
                "transactions": [
                  { 
                    "date": "YYYY/MM/DD", 
                    "type": "deposit" | "withdrawal", 
                    "amount": 123456, 
                    "description": "Full text", 
                    "partyName": "Clean Name", 
                    "tracking_code": "..." 
                  }
                ]
              }`
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

// در فایل app/actions/finance-actions.ts

// ✅ تابع جدید: ثبت کامل واریز و برداشت یک روز به صورت همزمان
export async function submitDayComplete(date: string, workspaceId: string) {
  console.log(`🚀 STARTING FULL PROCESS FOR DATE: ${date}`)

  const results = {
    deposit: null as any,
    withdrawal: null as any
  }

  // 1. اول واریزها را ثبت کن
  try {
    console.log(`--- Processing DEPOSITS for ${date} ---`)
    results.deposit = await submitDailyVoucher(date, workspaceId, "deposit")
  } catch (e) {
    console.error(`Error processing deposits for ${date}:`, e)
  }

  // 2. بلافاصله برداشت‌ها را ثبت کن (چسب پارس اینجاست!)
  try {
    console.log(`--- Processing WITHDRAWALS for ${date} ---`)
    results.withdrawal = await submitDailyVoucher(
      date,
      workspaceId,
      "withdrawal"
    )
  } catch (e) {
    console.error(`Error processing withdrawals for ${date}:`, e)
  }

  console.log(`🏁 FULL PROCESS FINISHED FOR ${date}`)
  return results
}

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
    console.log("📄 EXTRACTED DATA:", JSON.stringify(groupedData, null, 2))

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
          // 1. مبلغ
          let safeAmount = tx.amount
          if (typeof tx.amount === "string") {
            safeAmount =
              parseFloat(
                toEnglishDigits(tx.amount)
                  .replace(/,/g, "")
                  .replace(/[^0-9.]/g, "")
              ) || 0
          }

          // 2. نام
          let finalSupplierName =
            tx.partyName || tx.counterparty || "تراکنش بدون نام"
          finalSupplierName = finalSupplierName
            .replace(/خانم|آقای|فروشگاه|شرکت/g, "")
            .trim()
          if (finalSupplierName.length < 2)
            finalSupplierName = tx.description || "تراکنش بدون نام"

          const finalDate = getSafeDate(tx.date)

          // 3. کد رهگیری هوشمند (Deterministic ID)
          let finalTrackingCode = tx.tracking_code

          // اگر کد رهگیری ندارد یا نامشخص است
          if (
            !finalTrackingCode ||
            finalTrackingCode.includes("نامشخص") ||
            finalTrackingCode.length < 3
          ) {
            // 🛡️ راه حل امنیتی: تولید کد بر اساس محتوا (Content-Based ID)
            // فرمول: NO-REF-[مبلغ]-[تاریخ]-[۵ حرف اول نام]
            // این باعث می‌شود اگر فایل تکراری آپلود شود، کد تکراری تولید شود و دیتابیس جلویش را بگیرد.
            // اما اگر تراکنش متفاوتی باشد (مثل چسب پارس)، کد متفاوتی تولید می‌شود.

            const datePart = finalDate.replace(/[\/\-]/g, "") // حذف اسلش تاریخ
            const namePart = finalSupplierName
              .replace(/\s/g, "")
              .substring(0, 8) // ۸ حرف اول نام بدون فاصله

            finalTrackingCode = `NO-REF-${safeAmount}-${datePart}-${namePart}`

            console.log(
              `🔹 Generated Smart-ID for ${finalSupplierName}: ${finalTrackingCode}`
            )
          }

          // 4. نوع
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
            tracking_code: finalTrackingCode,
            receipt_image_url: finalFileUrl,
            description: tx.description || "",
            type: transactionType,
            counterparty: finalSupplierName,
            status: "pending_docs" as "pending_docs",
            assigned_user_id: user?.id || null,
            customer_group: "General",
            ai_verification_status: "pending" as "pending"
          }

          // 5. عملیات درج در دیتابیس (با لاگ دقیق خطا)
          const { data, error } = await supabase
            .from("payment_requests")
            .upsert(insertData, {
              onConflict: "tracking_code",
              ignoreDuplicates: true // ⛔️ مهم: اگر تکراری بود، نادیده بگیر (خواسته شما)
            })
            .select("id")
            .maybeSingle()

          if (error) {
            console.error("❌ Database Insert Error:", error) // لاگ خطا را ببینیم
            throw error
          }

          if (data) {
            insertedIds.push(data.id)
            successCount++
          } else {
            // اگر دیتا نال بود، یعنی تکراری بوده و ایگنور شده
            console.log(
              `⚠️ Duplicate skipped: ${finalSupplierName} (${finalTrackingCode})`
            )
          }
        } catch (err: any) {
          console.error("Tx Error:", err.message)
          errors.push(err.message)
        }
      }
    }

    console.log(
      `✅ [FINANCE_ACTION] Finished. Inserted: ${insertedIds.length} / Skipped duplicates.`
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
      description: `سند تجمیعی ${typeFarsi} - مورخ ${date}`,
      mode: type,
      totalAmount: totalAmount,
      date: searchDate,
      workspaceId: workspaceId, // ✅✅✅ این خط را اضافه کنید
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
          date: safeDate,
          workspaceId: workspaceId // ✅✅✅ این خط را اضافه کنید
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

export async function getRahkaranSLs() {
  if (!PROXY_URL || !PROXY_KEY) return []
  const sqlQuery = `
    SELECT TOP 2000 Code, Title 
    FROM [FIN3].[SL] 
    WHERE Code NOT LIKE '111005%' 
    ORDER BY Code ASC
  `
  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY },
      body: JSON.stringify({ query: sqlQuery }),
      cache: "no-store"
    })
    const data = await res.json()
    if (data.recordset) {
      return data.recordset.map((row: any) => ({
        code: row.Code,
        title: row.Title,
        fullLabel: `${row.Code} - ${row.Title}`
      }))
    }
    return []
  } catch (e) {
    console.error("Fetch SL Error:", e)
    return []
  }
}

// app/actions/finance-actions.ts

export async function getRahkaranAccounts() {
  const proxyUrl = process.env.RAHKARAN_PROXY_URL
  const proxyKey = process.env.RAHKARAN_PROXY_KEY

  if (!proxyUrl || !proxyKey) return []

  // ✅ کوئری ترکیبی: هم معین (SL) و هم تفصیلی (DL)
  // ما یک ستون مجازی 'Type' اضافه می‌کنیم تا در فرانت بتوانیم آیکون متفاوت نشان دهیم
  const sqlQuery = `
    SELECT TOP 2000 
        Code, 
        Title, 
        'SL' as Type, 
        CAST(Code AS NVARCHAR(50)) + ' - ' + Title as FullLabel
    FROM [FIN3].[SL] 
    WHERE Code NOT LIKE '111005%' -- حذف بانک‌ها
    
    UNION ALL
    
    SELECT TOP 2000 
        Code, 
        Title, 
        'DL' as Type, 
        Title + ' (' + CAST(Code AS NVARCHAR(50)) + ')' as FullLabel
    FROM [FIN3].[DL]
    WHERE Status = 1 -- فقط فعال‌ها
    ORDER BY Type DESC, Code ASC -- معین‌ها اول بیایند
  `

  try {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-proxy-key": proxyKey },
      body: JSON.stringify({ query: sqlQuery }),
      cache: "no-store"
    })

    const data = await res.json()

    if (data.recordset) {
      return data.recordset.map((row: any) => ({
        code: row.Code,
        title: row.Title,
        type: row.Type, // نوع حساب (SL یا DL)
        // افزودن ایموجی برای تشخیص چشمی راحت‌تر
        fullLabel:
          row.Type === "SL" ? `📘 ${row.FullLabel}` : `👤 ${row.FullLabel}`
      }))
    }
    return []
  } catch (e) {
    console.error("Fetch Accounts Error:", e)
    return []
  }
}

// ------------------------------------------------------------------
// 2. تابع اصلی: ثبت سند در راهکاران + آپدیت دیتابیس
// ------------------------------------------------------------------
// app/actions/finance-actions.ts
export async function approveUnspecifiedDocument(
  id: string,
  slCode: string,
  dlCode: string | null, // ✅ این ورودی قبلاً نبود و باعث ارور می‌شد
  description: string | null,
  workspaceId: string
) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { data: request } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", id)
      .single()

    if (!request) throw new Error("سند یافت نشد")

    const amount = Number(request.amount) || 0
    const isDeposit = request.type === "deposit" || request.type === "واریز"

    const finalDesc = description
      ? `${description}`
      : request.description || "ثبت دستی از داشبورد"

    // ارسال به راهکاران
    const rahkaranResult = await insertVoucherWithDL({
      slCode: slCode,
      dlCode: dlCode,
      amount: amount,
      description: finalDesc,
      isDeposit: isDeposit,
      date: request.payment_date || new Date().toISOString().split("T")[0]
    })

    if (!rahkaranResult.success) {
      throw new Error(rahkaranResult.error)
    }

    // آپدیت دیتابیس
    await supabase
      .from("payment_requests")
      .update({
        status: "completed",
        ai_verification_status: "manual_verified",
        description: finalDesc,
        rahkaran_doc_id: rahkaranResult.docNumber?.toString(),
        ai_verification_reason: `معین: ${slCode} / تفصیلی: ${dlCode || "ندارد"}`
      })
      .eq("id", id)

    revalidatePath(`/enterprise/${workspaceId}/finance/dashboard`, "page")
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// app/actions/finance-actions.ts

// ------------------------------------------------------------------
// تابع هوشمند SQL (نسخه با قابلیت ساخت خودکار تفصیلی + رفع باگ‌ها)
// ------------------------------------------------------------------
async function insertVoucherWithDL(params: {
  slCode: string
  dlCode: string | null
  amount: number
  description: string
  isDeposit: boolean
  date: string
}) {
  if (!PROXY_URL || !PROXY_KEY)
    return { success: false, error: "تنظیمات پروکسی موجود نیست" }

  const bankSL = "111005"
  const safeDesc = params.description.replace(/'/g, "''")

  // اگر DL انتخاب نشده بود، NULL بفرست
  const dlCodeValue = params.dlCode ? `'${params.dlCode}'` : "NULL"

  const sql = `
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Date NVARCHAR(20) = '${params.date}';
        DECLARE @Desc NVARCHAR(MAX) = N'${safeDesc}';
        DECLARE @SLCode NVARCHAR(50) = '${params.slCode}';
        
        DECLARE @VoucherID BIGINT, @VoucherNumber BIGINT, @VoucherLockID BIGINT;
        DECLARE @SLRef BIGINT, @GLRef BIGINT, @AccountGroupRef BIGINT;
        
        -- متغیرهای تفصیلی
        DECLARE @DLRef BIGINT = NULL, @DLTypeRef BIGINT = NULL;

        -- 1. پیدا کردن معین
        SELECT TOP 1 @SLRef = SLID, @GLRef = GLRef, @AccountGroupRef = (SELECT TOP 1 AccountGroupRef FROM [FIN3].[GL] WHERE GLID = SL.GLRef)
        FROM [FIN3].[SL] SL WHERE Code = @SLCode;

        IF @SLRef IS NULL THROW 51000, 'کد معین یافت نشد', 1;

        -- 2. پیدا کردن تفصیلی (اگر کاربر انتخاب کرده باشد)
        IF ${dlCodeValue} IS NOT NULL
        BEGIN
            SELECT TOP 1 @DLRef = DLID, @DLTypeRef = DLTypeRef 
            FROM [FIN3].[DL] WHERE Code = ${dlCodeValue};
            
            IF @DLRef IS NULL THROW 51000, 'کد تفصیلی انتخاب شده نامعتبر است', 1;
        END

        -- 3. هدر سند
        DECLARE @BranchRef BIGINT = 1, @LedgerRef BIGINT = 1, @UserRef INT = 1;
        DECLARE @FiscalYearRef BIGINT;
        SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] WHERE LedgerRef = @LedgerRef ORDER BY EndDate DESC;

        EXEC [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;
        SELECT @VoucherNumber = ISNULL(MAX(Number), 0) + 1 FROM [FIN3].[Voucher] WHERE FiscalYearRef = @FiscalYearRef AND LedgerRef = @LedgerRef;

        INSERT INTO [FIN3].[Voucher] (
            VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
            Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
            Description, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields, DailyNumber, Sequence
        ) VALUES (
            @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, @VoucherNumber,
            @Date, 1, @UserRef, GETDATE(), @UserRef, GETDATE(), 0,
            @Desc, 0, 0, 0, 0, @VoucherNumber, @VoucherNumber
        );

        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherLock', @Id = @VoucherLockID OUTPUT;
        INSERT INTO [FIN3].[VoucherLock] (VoucherLockID, VoucherRef, UserRef, LastModificationDate) 
        VALUES (@VoucherLockID, @VoucherID, @UserRef, GETDATE());

        -- 4. آیتم طرف حساب (با تفصیلی مشخص)
        DECLARE @ItemID1 BIGINT;
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @ItemID1 OUTPUT;
        
        INSERT INTO [FIN3].[VoucherItem] (
            VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
            Debit, Credit, Description, RowNumber, IsCurrencyBased,
            DLLevel4, DLTypeRef4 -- قرار دادن تفصیلی در سطح 4
        ) VALUES (
            @ItemID1, @VoucherID, @BranchRef, @SLRef, @SLCode, @GLRef, @AccountGroupRef,
            ${params.isDeposit ? 0 : params.amount}, ${params.isDeposit ? params.amount : 0}, 
            @Desc, 1, 0,
            CASE WHEN @DLRef IS NOT NULL THEN ${dlCodeValue} ELSE NULL END, 
            CASE WHEN @DLRef IS NOT NULL THEN @DLTypeRef ELSE NULL END
        );

        -- 5. آیتم بانک
        DECLARE @BankSLRef BIGINT, @BankGLRef BIGINT, @BankAG BIGINT, @ItemID2 BIGINT;
        SELECT TOP 1 @BankSLRef = SLID, @BankGLRef = GLRef, @BankAG = (SELECT TOP 1 AccountGroupRef FROM [FIN3].[GL] WHERE GLID = SL.GLRef) 
        FROM [FIN3].[SL] WHERE Code = '${bankSL}';

        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @ItemID2 OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
            VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
            Debit, Credit, Description, RowNumber, IsCurrencyBased
        ) VALUES (
            @ItemID2, @VoucherID, @BranchRef, @BankSLRef, '${bankSL}', @BankGLRef, @BankAG,
            ${params.isDeposit ? params.amount : 0}, ${params.isDeposit ? 0 : params.amount},
            N'بانک - ' + @Desc, 2, 0
        );

        UPDATE [FIN3].[Voucher] SET State = 1 WHERE VoucherID = @VoucherID;
        COMMIT TRANSACTION;
        SELECT 'Success' as Status, @VoucherNumber as VoucherNum;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 'Error' as Status, ERROR_MESSAGE() as ErrMsg;
    END CATCH
  `

  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY },
      body: JSON.stringify({ query: sql }),
      cache: "no-store"
    })

    const json = await res.json()
    const resultRow = json.recordset ? json.recordset[0] : null

    if (resultRow && resultRow.Status === "Success") {
      return { success: true, docNumber: resultRow.VoucherNum }
    } else {
      return {
        success: false,
        error: resultRow ? resultRow.ErrMsg : "خطای SQL"
      }
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
// ------------------------------------------------------------------
// 3. تابع کمکی: اجرای کوئری SQL اینسرت (هسته اصلی)
// ------------------------------------------------------------------
async function insertManualVoucherToRahkaran(params: {
  slCode: string
  amount: number
  description: string
  isDeposit: boolean
  date: string
}) {
  if (!PROXY_URL || !PROXY_KEY)
    return { success: false, error: "تنظیمات پروکسی موجود نیست" }

  // منطق بدهکار/بستانکار
  // اگر واریز است: بانک (111005) بدهکار، طرف حساب (slCode) بستانکار
  // اگر برداشت است: طرف حساب (slCode) بدهکار، بانک (111005) بستانکار
  const bankSL = "111005"

  // تبدیل تاریخ (اگر نیاز به تبدیل میلادی به شمسی در سمت SQL دارید، اینجا پیچیده می‌شود)
  // فعلا فرض بر این است که تاریخ میلادی می‌فرستیم و راهکاران هندل می‌کند یا تاریخ امروز
  const dateStr = params.date

  const sql = `
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @VoucherID BIGINT;
        DECLARE @VoucherNumber BIGINT;
        DECLARE @BranchRef BIGINT = 1; -- کد شعبه پیش‌فرض
        DECLARE @LedgerRef BIGINT = 1; -- دفتر کل پیش‌فرض
        DECLARE @UserRef INT = 1; -- کاربر سیستم
        DECLARE @FiscalYearRef BIGINT;
        
        -- 1. پیدا کردن سال مالی
        SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] WHERE LedgerRef = @LedgerRef ORDER BY EndDate DESC;

        -- 2. ساخت هدر سند
        EXEC [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;
        
        SELECT @VoucherNumber = ISNULL(MAX(Number), 0) + 1 FROM [FIN3].[Voucher] 
        WHERE FiscalYearRef = @FiscalYearRef AND LedgerRef = @LedgerRef;

        INSERT INTO [FIN3].[Voucher] (
            VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
            Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
            Description, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields, DailyNumber, Sequence
        ) VALUES (
            @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, @VoucherNumber,
            '${dateStr}', 1, @UserRef, GETDATE(), @UserRef, GETDATE(), 0,
            N'${params.description}', 0, 0, 0, 0, @VoucherNumber, @VoucherNumber
        );

        -- متغیرهای کمکی آیتم
        DECLARE @BankSLRef BIGINT, @PartySLRef BIGINT;
        DECLARE @BankGLRef BIGINT, @PartyGLRef BIGINT;
        DECLARE @BankAG BIGINT, @PartyAG BIGINT;
        DECLARE @ItemID1 BIGINT, @ItemID2 BIGINT;

        -- پیدا کردن رفرنس‌های بانک
        SELECT TOP 1 @BankSLRef = SLID, @BankGLRef = GLRef FROM [FIN3].[SL] WHERE Code = '${bankSL}';
        SELECT TOP 1 @BankAG = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @BankGLRef;

        -- پیدا کردن رفرنس‌های حساب انتخابی کاربر
        SELECT TOP 1 @PartySLRef = SLID, @PartyGLRef = GLRef FROM [FIN3].[SL] WHERE Code = '${params.slCode}';
        SELECT TOP 1 @PartyAG = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @PartyGLRef;

        IF @PartySLRef IS NULL THROW 51000, 'کد معین انتخاب شده در سیستم یافت نشد', 1;

        -- 3. آیتم اول: طرف حساب (کاربر)
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @ItemID1 OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
            VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
            Debit, Credit, Description, RowNumber
        ) VALUES (
            @ItemID1, @VoucherID, @BranchRef, @PartySLRef, '${params.slCode}', @PartyGLRef, @PartyAG,
            ${params.isDeposit ? 0 : params.amount}, -- بدهکار (در برداشت)
            ${params.isDeposit ? params.amount : 0}, -- بستانکار (در واریز)
            N'${params.description}', 1
        );

        -- 4. آیتم دوم: بانک
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @ItemID2 OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
            VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
            Debit, Credit, Description, RowNumber
        ) VALUES (
            @ItemID2, @VoucherID, @BranchRef, @BankSLRef, '${bankSL}', @BankGLRef, @BankAG,
            ${params.isDeposit ? params.amount : 0}, -- بدهکار (در واریز)
            ${params.isDeposit ? 0 : params.amount}, -- بستانکار (در برداشت)
            N'بانک - ${params.description}', 2
        );

        -- پایان
        UPDATE [FIN3].[Voucher] SET State = 1 WHERE VoucherID = @VoucherID; -- موقت
        
        COMMIT TRANSACTION;
        SELECT 'Success' as Status, @VoucherNumber as VoucherNum;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SELECT 'Error' as Status, ERROR_MESSAGE() as ErrMsg;
    END CATCH
  `

  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY },
      body: JSON.stringify({ query: sql }),
      cache: "no-store"
    })
    const json = await res.json()
    const resultRow = json.recordset ? json.recordset[0] : null

    if (resultRow && resultRow.Status === "Success") {
      return { success: true, docNumber: resultRow.VoucherNum }
    } else {
      return {
        success: false,
        error: resultRow ? resultRow.ErrMsg : "خطای ناشناخته در SQL"
      }
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function getRahkaranDLs() {
  if (!process.env.RAHKARAN_PROXY_URL) return []

  // ⚠️ تغییر: حذف شرط Status = 1 برای تست
  // ⚠️ تغییر: فقط ۱۰ تا رکورد بگیر تا ببینیم اصلا جدول را می‌شناسد یا نه
  const sqlQuery = `
    SELECT TOP 5000 Code, Title 
    FROM [FIN3].[DL] 
    ORDER BY Code DESC
  `

  try {
    const res = await fetch(process.env.RAHKARAN_PROXY_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-proxy-key": process.env.RAHKARAN_PROXY_KEY!
      },
      body: JSON.stringify({ query: sqlQuery }),
      cache: "no-store"
    })

    const data = await res.json()

    // لاگ کردن نتیجه برای فهمیدن مشکل
    console.log("DL Query Result:", JSON.stringify(data).substring(0, 200)) // فقط ۲۰۰ کاراکتر اول

    if (data.recordset) {
      return data.recordset.map((row: any) => ({
        code: row.Code,
        title: row.Title,
        fullLabel: `👤 ${row.Title} (${row.Code})`
      }))
    }

    // اگر ارور SQL باشد اینجا چاپ می‌شود
    if (data.error) {
      console.error("❌ SQL Error on DL:", data.error)
    }

    return []
  } catch (e) {
    console.error("Fetch DL Error:", e)
    return []
  }
}
