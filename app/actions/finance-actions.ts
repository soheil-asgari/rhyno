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
    if (retries <= 0) throw error // اگر تعداد تلاش تموم شد، ارور رو بفرست
    console.warn(`⚠️ Retrying... attempts left: ${retries}`)
    await new Promise(res => setTimeout(res, delay)) // صبر کن
    return withRetry(fn, retries - 1, delay) // دوباره تلاش کن
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
          content:
            "You are a smart financial auditor. You distinguish between payment receipts (Withdrawals) and proof of payments (Deposits)."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this banking receipt (Page ${pageNumber}).

              **Context:**
              - Mobile screenshots from clients proving payment = **DEPOSIT** (واریز).
              - Official bank receipts of us paying others = **WITHDRAWAL** (برداشت).

              **OCR Text:**
              """
              ${pageText}
              """

              **DECISION LOGIC:**
              1. **Direction:** - If "Transfer To/انتقال به" appears on a *mobile screenshot*, it's likely a customer paying us -> **DEPOSIT**.
                 - If Receiver is "Asgari/Rhyno" -> **DEPOSIT**.
                 - If Sender is "Asgari/Rhyno" -> **WITHDRAWAL**.
              
              2. **Counterparty:**
                 - **DEPOSIT:** Counterparty is the **SENDER**.
                 - **WITHDRAWAL:** Counterparty is the **RECEIVER**.
                 - *Handwritten Priority:* Always use handwritten names if present.

              3. **Amount:** Extract total in Rials.

              **Output JSON:**
              {
                "transactions": [
                   {
                     "date": "YYYY/MM/DD",
                     "type": "Deposit" | "Withdrawal",
                     "amount": Number,
                     "description": "Full description",
                     "partyName": "Counterparty Name",
                     "tracking_code": "Trace Number"
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
      max_tokens: 4000
    })

    if (!response.choices || response.choices.length === 0)
      throw new Error("Empty response")

    let rawContent = response.choices[0].message.content || "{}"
    rawContent = rawContent
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()

    if (!rawContent.endsWith("}")) rawContent += "}"
    if (!rawContent.endsWith("]}") && rawContent.endsWith("]"))
      rawContent = `{"transactions": ${rawContent}}`

    const data = JSON.parse(rawContent)
    return { success: true, data }
  } catch (error: any) {
    console.error(`Page ${pageNumber} Error:`, error)
    return { success: false, error: error.message }
  }
}
function getSafeDate(inputDate: string | undefined): string {
  // تاریخ پیش‌فرض: امروز
  const today = new Date().toISOString().split("T")[0]

  if (!inputDate) return today

  try {
    // 1. تبدیل تمام اعداد به انگلیسی
    let cleanStr = toEnglishDigits(inputDate)

    // 2. اصلاح جداکننده‌ها (تبدیل / به -)
    cleanStr = cleanStr.replace(/\//g, "-")

    // 3. تلاش برای ساخت آبجکت تاریخ
    // نکته: اینجا لوکال را حذف کردیم تا اعداد خروجی حتما انگلیسی باشند
    const dateObj = new DateObject({
      date: cleanStr,
      format: "YYYY-MM-DD",
      calendar: persian
    })

    if (dateObj.isValid) {
      // تبدیل به میلادی
      const gregorianDate = dateObj.convert(gregorian)
      const year = gregorianDate.year

      // 4. بررسی سال‌های پرت (مثلاً سال ۲۶۴۶ یا زیر ۲۰۰۰)
      // اگر سال میلادی کمتر از 2000 یا بیشتر از 2030 باشد، یعنی تاریخ اشتباه خوانده شده
      if (year < 2000 || year > 2030) {
        console.warn(
          `⚠️ تاریخ نامعتبر شناسایی شد (${cleanStr} -> ${year}). استفاده از تاریخ امروز.`
        )
        return today
      }

      // فرمت خروجی حتما انگلیسی: YYYY-MM-DD
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
          // --- Amount Cleaning ---
          let safeAmount = tx.amount
          if (typeof tx.amount === "string") {
            safeAmount =
              parseFloat(
                toEnglishDigits(tx.amount)
                  .replace(/,/g, "")
                  .replace(/[^0-9.]/g, "")
              ) || 0
          }

          // --- Name Cleaning ---
          let finalSupplierName =
            tx.partyName || tx.counterparty || "تراکنش بدون نام"
          finalSupplierName = finalSupplierName
            .replace(/خانم|آقای|فروشگاه|شرکت/g, "")
            .trim()
          if (finalSupplierName.length < 2)
            finalSupplierName = tx.description || "تراکنش بدون نام"

          // ✅✅✅ استفاده از تابع جدید تاریخ (اینجا مشکل حل می‌شود)
          const finalDate = getSafeDate(tx.date)

          // --- Officer Logic ---
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
            payment_date: finalDate, // الان مطمئنیم که فرمت 2024-05-20 است
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

    // try { revalidatePath(`/enterprise/${workspaceId}/finance/documents`) } catch (e) { }

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

// ------------------------------------------------------------------
// 4. Verify & Settle (اصلاح شده برای شرح فارسی)
// ------------------------------------------------------------------
export async function verifyAndSettleRequest(
  requestId: string,
  workspaceId: string,
  invoiceUrl: string,
  warehouseUrl: string
) {
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  try {
    const { data: request } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("id", requestId)
      .single()

    if (!request) throw new Error("رکورد پیدا نشد")

    // AI Audit
    const prompt = `Act as auditor. Compare Invoice/Warehouse amount with ${request.amount}. Tolerance 1%. JSON: {"is_match": true, "reason": "ok"}`
    const response = await openai.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: invoiceUrl } }
          ]
        }
      ] as any
    })
    const aiResult = JSON.parse(
      response.choices[0].message.content?.replace(/```json|```/g, "") || "{}"
    )

    if (!aiResult.is_match) {
      await supabase
        .from("payment_requests")
        .update({
          ai_verification_status: "rejected",
          ai_verification_reason: aiResult.reason
        })
        .eq("id", requestId)
      revalidatePath(`/enterprise/${workspaceId}/finance/cartable`)
      return { success: false, approved: false, reason: aiResult.reason }
    }

    // ✅ ترجمه نوع تراکنش به فارسی برای شرح سند
    const typeFarsi = request.type === "deposit" ? "واریز" : "برداشت"

    // ✅ ساخت شرح سند تمیز و فارسی
    const docDescription = `سند سیستمی ${typeFarsi} وجه - کد رهگیری: ${request.tracking_code || "---"}`

    // Rahkaran Sync
    let items = []
    if (request.type === "deposit") {
      items = [
        {
          partyName: request.counterparty || request.supplier_name,
          amount: request.amount,
          type: "Creditor",
          description: `بابت واریز وجه - ${request.description || ""}` // شرح آرتیکل
        },
        {
          moinCode: "111005",
          partyName: "بانک",
          amount: request.amount,
          type: "Debtor",
          description: `دریافت وجه از ${request.counterparty || "نامشخص"}`
        }
      ]
    } else {
      items = [
        {
          partyName: request.counterparty || request.supplier_name,
          amount: request.amount,
          type: "Debtor",
          description: `بابت پرداخت وجه - ${request.description || ""}` // شرح آرتیکل
        },
        {
          moinCode: "111005",
          partyName: "بانک",
          amount: request.amount,
          type: "Creditor",
          description: `پرداخت به ${request.counterparty || "نامشخص"}`
        }
      ]
    }

    const rahkaranRes = await withRetry(
      async () => {
        console.log("🔄 Connecting to Rahkaran Proxy...")
        return await syncToRahkaranSystem({
          mode: request.type === "deposit" ? "Deposit" : "Withdrawal",
          description: docDescription,
          branchId: 1,
          items: items
        })
      },
      3,
      2000
    )
    if (!rahkaranRes.success)
      throw new Error(`Rahkaran Proxy Error: ${rahkaranRes.error}`)

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

    // revalidatePath(`/enterprise/${workspaceId}/finance/cartable`) // قبلا گفتیم کامنت کنید برای جلوگیری از رفرش
    return { success: true, approved: true, reason: rahkaranRes.docId } // اصلاح: برگرداندن شناسه سند
  } catch (error: any) {
    // 👇👇👇 این خط رو اضافه کن تا توی ترمینال VSCode خطا رو ببینی
    console.log(
      "❌❌❌ RAHKARAN SYNC ERROR DETAILS:",
      JSON.stringify(error, null, 2)
    )
    if (error.response) {
      console.log("DATA:", error.response.data)
    }
    // 👆👆👆

    console.error("Verify Error:", error)
    return { success: false, error: error.message }
  }
}

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

    // revalidatePath(`/enterprise/${workspaceId}/finance/documents`)
    return { success: true }
  } catch (error: any) {
    console.error("Manual Completion Error:", error)
    return { success: false, error: error.message }
  }
}

// --- حتماً کلمه export در ابتدای خط باشد (این همان چیزی است که پاک شده بود) ---
export async function addRequestNote(requestId: string, noteText: string) {
  // متغیرهای محیطی که قبلاً تنظیم کردید
  const proxyUrl = process.env.RAHKARAN_PROXY_URL
  const proxyKey = process.env.RAHKARAN_PROXY_KEY

  // --- بخش کوئری SQL (منطقی که شما باید اینجا بگذارید) ---
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
  // ------------------------------------------------------------------

  if (!proxyUrl || !proxyKey) {
    return { success: false, error: "Proxy configuration is missing." }
  }

  if (!proxyUrl || !proxyKey)
    return { success: false, error: "Proxy config missing" }

  try {
    // 🔥 اعمال RETRY LOGIC برای یادداشت هم خوب است
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
