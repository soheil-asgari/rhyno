"use server"

import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { OpenRouter } from "@openrouter/sdk"
import { revalidatePath } from "next/cache"
import DateObject from "react-date-object"
import persian from "react-date-object/calendars/persian"
import gregorian from "react-date-object/calendars/gregorian"
import persian_fa from "react-date-object/locales/persian_fa"
import { syncToRahkaranSystem } from "@/lib/services/rahkaran"
import { sendAssignmentSMS, sendCompletionSMS } from "@/lib/sms-service"
import {
  detectBankInfoByNumber,
  findSmartRule,
  generateCleanDescription
} from "@/lib/services/bankIntelligence"
import { findAccountCode } from "@/lib/services/rahkaran"

// const WINDOWS_SERVER_URL = "http://185.226.119.248:8005/ocr";

const PROXY_URL = process.env.RAHKARAN_PROXY_URL
const PROXY_KEY = process.env.RAHKARAN_PROXY_KEY

const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!
})
const AI_MODEL = "google/gemini-2.5-pro"

export interface SinglePageResult {
  success: boolean
  data?: any
  error?: string
}
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
  fileUrl: string,

  pageNumber: number,

  pageText: string = ""
): Promise<SinglePageResult> {
  // مدل AI_MODEL باید قبلاً در فایل شما تعریف شده باشد

  try {
    console.log(
      `📡 Analyzing Bank Statement directly with AI (Conditional Logic)...`
    )

    // 1. دانلود فایل

    const fileRes = await fetch(fileUrl, { cache: "no-store" })

    if (!fileRes.ok) throw new Error("دانلود فایل ناموفق بود")

    const fileBuffer = await fileRes.arrayBuffer()

    const base64Data = Buffer.from(fileBuffer).toString("base64")

    const mimeType = fileUrl.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg"

    // 2. ارسال به هوش مصنوعی با دستورالعمل شرطی و مقتدر

    const aiResponse = await withRetry(
      async () => {
        return await openRouter.chat.send({
          model: AI_MODEL,

          messages: [
            {
              role: "system",

              content: `You are an expert Bank Statement Auditor and Data Extractor for Persian Documents.

           

            YOUR TASK: Extract ALL transactions from the table and header information.



            CRITICAL COLUMN AUTHORITY RULES:

           

            1. **COLUMN CHECK (CONDITIONAL LOGIC):**

               a. **IF** you see separate columns named "بدهکار" (Debit) AND "بستانکار" (Credit):

                  - Use them strictly. Put amount from "بدهکار" into 'withdrawal' and "بستانکار" into 'deposit'.

               b. **IF** you see only ONE amount column (e.g., "مبلغ تراکنش"):

                  - Amounts with a MINUS sign (-) must be put into 'withdrawal'.

                  - Amounts without a minus sign (positive) must be put into 'deposit'.

           

            2. **VETO RULE (مانده):** You MUST ignore the "مانده" (Balance) column. Do NOT extract its value as a transaction amount under any circumstance.

           

            3. **HANDWRITING & METADATA:** Look closely for handwritten notes (متن‌های دست‌نویس) and faint text (e.g., payer/payee names or transfer reasons). You MUST append any such found text to the 'description' field.

           

            4. **Data Quality:** Extract "شماره سند/پیگیری" as tracking_code. Remove all separators (commas, dots, etc.) from numbers. Ensure no transaction amount is 0 unless the row is truly empty.

          CRITICAL NEW RULE (HANDWRITING):
- Look specifically for HANDWRITTEN notes on the statement row (usually describing the nature of transaction).
- Extract this text into a separate field called "handwritten_text".
- Set "is_handwritten": true if such text exists.

            OUTPUT JSON FORMAT:

            {

              "header": { "account_number": "string (digits only)", "owner_name": "string" },

              "transactions": [

                {

                 "date": "YYYY/MM/DD (Extract exactly as printed on the doc. If it is Jalali e.g. 1403/09/29, keep it as 1403. Do NOT convert year to Gregorian)",

                  "time": "HH:MM",

                  "description": "string (full description + appended handwritten text)",
                  "handwritten_text": "string (extracted handwriting)", 
                  "is_handwritten": boolean,

                  "tracking_code": "string (from 'شماره سند/پیگیری', digits only)",

                  "withdrawal": number (amount from Bedekhar column, or negative amount from single column),

                  "deposit": number (amount from Bestankar column, or positive amount from single column)

                }

              ]

            }`
            },

            {
              role: "user",

              content: [
                {
                  type: "text",
                  text: "Extract table data accurately. Trust the column position and the conditional logic."
                },

                {
                  type: "image_url",
                  imageUrl: { url: `data:${mimeType};base64,${base64Data}` }
                }
              ]
            }
          ],

          responseFormat: { type: "json_object" },

          temperature: 0
        })
      },
      2,
      2000
    )

    const content = aiResponse.choices[0].message.content as string
    const aiJson = JSON.parse(content || "{}")

    if (!aiJson.transactions) {
      throw new Error("AI could not extract transactions structure.")
    }

    // 3. پردازش هدر و تشخیص بانک میزبان

    const headerFromAI = aiJson.header || {}

    const extractedAccNum = headerFromAI.account_number
      ? headerFromAI.account_number.replace(/[^0-9]/g, "")
      : ""

    console.log(`🔍 AI Detected Header Account: ${extractedAccNum}`)

    // تشخیص بانک میزبان (نیاز به detectBankInfoByNumber در bankIntelligence.ts)

    let bankDetails = detectBankInfoByNumber(extractedAccNum)

    if (bankDetails.dlCode !== "200001") {
      console.log(
        `🎯 Host Bank Resolved: ${bankDetails.bankName} (DL: ${bankDetails.dlCode})`
      )
    } else {
      console.warn(`⚠️ Host Bank NOT resolved from header: ${extractedAccNum}`)
    }

    const rawTransactions = aiJson.transactions || []

    console.log(`✅ AI Extracted ${rawTransactions.length} items.`)

    // 4. حلقه غنی‌سازی (فقط از خروجی AI استفاده می‌کند)

    const enrichedTransactions = await Promise.all(
      rawTransactions.map(async (tx: any) => {
        // ادغام دست‌نویس با شرح (دست‌نویس اولویت دارد و اول می‌آید)
        let fullDescription = tx.description || ""
        if (tx.is_handwritten && tx.handwritten_text) {
          fullDescription = `${tx.handwritten_text} - ${fullDescription}`
        }

        // منطق تعیین نوع و مبلغ دقیق

        let type: "deposit" | "withdrawal" = "withdrawal"

        let amount = 0

        // چون AI حالا تمام حالت‌ها را در دو فیلد deposit و withdrawal جمع‌آوری کرده، فقط کافی است یکی را انتخاب کنیم

        if (tx.deposit && Number(tx.deposit) > 0) {
          type = "deposit"

          amount = Number(tx.deposit)
        } else if (tx.withdrawal && Number(tx.withdrawal) > 0) {
          type = "withdrawal"

          // نکته: اگر خروجی AI منفی بود (برای ستون تک‌مقداری)، اینجا آن را مثبت می‌کنیم

          amount = Math.abs(Number(tx.withdrawal))
        }

        const safeDate = toEnglishDigits(tx.date)

        const safeTrack = toEnglishDigits(tx.tracking_code)

        const currentTx = {
          date: safeDate,

          time: tx.time || "00:00",

          type: type,

          amount: amount,

          description: fullDescription,

          partyName: "نامشخص",

          tracking_code: safeTrack,

          dl_code: null as string | null,

          dl_type: null as number | null,

          sl_code: null as string | null,

          ai_verification_status: "pending"
        }

        // الف: قوانین هوشمند

        // الف: قوانین هوشمند (شامل قوانین ثابت و هوش مصنوعی دیتابیس)
        const smartMatch = await findSmartRule(
          tx.description,
          currentTx.partyName || ""
        )

        if (smartMatch) {
          // تعیین کد معین یا تفصیلی بر اساس نوع بازگشتی
          if (smartMatch.type === "DL") {
            currentTx.dl_code = smartMatch.code
          } else if (smartMatch.type === "SL") {
            currentTx.sl_code = smartMatch.code
          }

          currentTx.partyName = smartMatch.title

          // ✅ تغییر مهم: وضعیت را "verified" می‌زنیم تا در پنل سبز شود
          currentTx.ai_verification_status = "verified"

          // چون قانون هوشمند پیدا شد، دیگر جستجوهای بعدی را انجام نده و برگرد
          return currentTx
        }
        // ب: استخراج نام

        const extractedName = extractNameFromDesc(tx.description)

        if (extractedName) currentTx.partyName = extractedName

        // ج: جستجوی در راهکاران

        if (currentTx.partyName !== "نامشخص") {
          try {
            const matchedEntity = await findAccountCode(currentTx.partyName)

            if (matchedEntity && matchedEntity.dlCode) {
              currentTx.dl_code = matchedEntity.dlCode

              currentTx.dl_type = matchedEntity.dlType || null

              currentTx.partyName = matchedEntity.foundName
            }
          } catch (e) {
            console.error(`Search failed for ${currentTx.partyName}`, e)
          }
        }

        return currentTx
      })
    )

    return {
      success: true,

      data: {
        header_info: { ...headerFromAI, number: extractedAccNum },

        bank_details: bankDetails,

        transactions: enrichedTransactions
      }
    }
  } catch (e: any) {
    console.error("AI Bridge Failed:", e)

    return { success: false, error: e.message }
  }
}
// تابع کمکی برای استخراج نام (همان که قبلا دادم)
function extractNameFromDesc(desc: string): string | null {
  if (!desc) return null
  const keywords = [
    "فرستنده:",
    "گیرنده:",
    "به نام",
    "شرکت",
    "فروشگاه",
    "آقای",
    "خانم",
    "در وجه"
  ]
  for (const key of keywords) {
    if (desc.includes(key)) {
      const parts = desc.split(key)
      if (parts.length > 1) {
        let nameCandidate = parts[1].trim().split(" ").slice(0, 5).join(" ")
        nameCandidate = nameCandidate.split(/[\-\/]/)[0].trim()
        if (nameCandidate.length > 2) return nameCandidate
      }
    }
  }
  return null
}

function getSafeDate(inputDate: string | undefined): string {
  const today = new Date().toISOString().split("T")[0]
  if (!inputDate) return today

  try {
    let cleanStr = toEnglishDigits(inputDate).replace(/\//g, "-")
    const parts = cleanStr.split("-")
    const yearPart = parseInt(parts[0])

    // اگر سال شمسی است (بین 1300 تا 1500)
    if (yearPart >= 1300 && yearPart <= 1500) {
      const dateObj = new DateObject({
        date: cleanStr,
        format: "YYYY-MM-DD",
        calendar: persian
      })
      if (dateObj.isValid) {
        return dateObj.convert(gregorian).format("YYYY-MM-DD")
      }
    }

    // اگر سال میلادی است (مثلا 2025)
    if (yearPart > 1900 && yearPart < 2100) {
      return cleanStr
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
  // ۱. دریافت اطلاعات از جدول مپینگ (شامل موبایل اکسل)
  const { data: mapping } = await supabase
    .from("customer_mappings")
    .select("officer_email, officer_phone, group_name") // ✅ دریافت officer_phone
    .eq("workspace_id", workspaceId)
    .ilike("customer_name", customerName)
    .maybeSingle()

  if (!mapping?.officer_email) return null

  // ۲. پیدا کردن ID کاربر از روی ایمیل
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, phone") // دریافت تلفن پروفایل هم برای احتیاط
    .eq("username", mapping.officer_email)
    .maybeSingle()

  return {
    officerId: profile?.user_id,
    groupName: mapping.group_name,
    // ✅ اولویت با شماره اکسل است، اگر نبود شماره پروفایل
    officerPhone: mapping.officer_phone || profile?.phone
  }
}

// ------------------------------------------------------------------
// 3. Submit Transactions (Fixed: returns IDs)
// ------------------------------------------------------------------

// در فایل app/actions/finance-actions.ts

// ✅ تابع جدید: ثبت کامل واریز و برداشت یک روز به صورت همزمان
// در فایل app/actions/finance-actions.ts

export async function submitDayComplete(
  date: string,
  workspaceId: string,
  hostBankDL: string | null
) {
  console.log(
    `🚀 STARTING FULL PROCESS FOR DATE: ${date} | BankDL: ${hostBankDL}`
  )

  const results = { deposit: null as any, withdrawal: null as any }

  // ✅ تابع کمکی داخلی برای مدیریت تلاش مجدد (Retry Loop)
  const processWithRetry = async (type: "deposit" | "withdrawal") => {
    const maxAttempts = 5 // ۵ بار تلاش
    const delayMs = 10000 // ۱۰ ثانیه وقفه

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (attempt > 1) {
          console.log(
            `🔄 [${type}] Retrying... Attempt ${attempt}/${maxAttempts}`
          )
        }

        // فراخوانی تابع اصلی
        const result = await submitDailyVoucher(
          date,
          workspaceId,
          type,
          hostBankDL
        )

        // ۱. اگر موفق بود، سریع برگردان
        if (result.success) {
          return result
        }

        // ۲. اگر ارور "تراکنشی یافت نشد" بود، تلاش مجدد لازم نیست (چون دیتایی نیست)
        if (result.error && result.error.includes("تراکنشی برای تاریخ")) {
          console.warn(`⚠️ [${type}] No transactions found. Skipping retry.`)
          return result
        }

        // ۳. اگر ارور دیگری بود (مثل خطای شبکه یا SQL)، پرتاب کن تا برود در catch و دوباره تلاش شود
        throw new Error(result.error || "Unknown Error")
      } catch (error: any) {
        console.error(
          `❌ [${type}] Error on attempt ${attempt}:`,
          error.message
        )

        // اگر آخرین تلاش هم شکست خورد، ارور نهایی را برگردان
        if (attempt === maxAttempts) {
          console.error(`🔥 [${type}] Failed after ${maxAttempts} attempts.`)
          return { success: false, error: error.message }
        }

        // وقفه قبل از تلاش بعدی
        console.log(`⏳ Waiting ${delayMs / 1000}s before next retry...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }

  // 1. پردازش واریزها (با مکانیزم تلاش مجدد)
  results.deposit = await processWithRetry("deposit")

  // 2. پردازش برداشت‌ها (با مکانیزم تلاش مجدد)
  results.withdrawal = await processWithRetry("withdrawal")

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

    const twoDaysLater = new Date()
    twoDaysLater.setDate(twoDaysLater.getDate() + 2)
    const deadlineISO = twoDaysLater.toISOString()

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
            // ... (Logic for generating ID for unknown tracking codes remains the same) ...
            const datePart = finalDate.replace(/[\/\-]/g, "")
            const namePart = finalSupplierName
              .replace(/\s/g, "")
              .substring(0, 8)
            const uniqueSuffix = Math.random().toString(36).substring(2, 7)
            finalTrackingCode = `NO-REF-${safeAmount}-${datePart}-${namePart}-${uniqueSuffix}`
          } else {
            // ✅ FIX: Append amount to real tracking codes to prevent duplicates (e.g., fee + main transaction)
            // This solves the issue where "FrpB0121" was skipped for the 12B IRR transaction
            finalTrackingCode = `${finalTrackingCode}-${safeAmount}`
          }

          // 4. نوع
          let transactionType = "withdrawal"
          if (tx.type && typeof tx.type === "string") {
            const t = tx.type.toLowerCase().trim()
            if (t === "deposit" || t === "واریز" || t.includes("dep"))
              transactionType = "deposit"
          }

          const officerInfo = await findOfficerForCustomer(
            supabase,
            workspaceId,
            finalSupplierName
          )
          const assignedUserId = officerInfo?.officerId || user?.id
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
            assigned_user_id: assignedUserId,
            deadline: deadlineISO,
            customer_group: officerInfo?.groupName || "General",
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
          if (data && assignedUserId !== user?.id) {
            // اگر شماره موبایلی پیدا کردیم (چه از اکسل چه پروفایل)
            if (officerInfo?.officerPhone) {
              await sendAssignmentSMS(
                officerInfo.officerPhone,
                finalSupplierName
              )
              console.log(
                `📨 SMS sent to ${officerInfo.officerPhone} for ${finalSupplierName}`
              )
            } else {
              console.warn(
                `⚠️ No phone number found for officer of ${finalSupplierName}`
              )
            }
          }

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

export async function submitDailyVoucher(
  date: string,
  workspaceId: string,
  type: "deposit" | "withdrawal",
  hostBankDL: string | null
) {
  console.log(
    `🔄 [FINANCE_ACTION] submitDailyVoucher called. Input Date: ${date}, Type: ${type}`
  )
  const cookieStore = cookies()
  const supabase = createClient(cookieStore)
  const finalBankDL = hostBankDL

  try {
    // ✅ تبدیل تاریخ ورودی (شمسی) به میلادی برای جستجو در دیتابیس
    const searchDate = getSafeDate(date)
    console.log(`📅 Converting date for search: ${date} -> ${searchDate}`)

    // 1. دریافت داده‌ها با تاریخ میلادی
    const { data: requests } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("payment_date", searchDate)
      .eq("type", type)
      .is("rahkaran_doc_id", null)

    if (!requests || requests.length === 0) {
      console.warn(
        `⚠️ [FINANCE_ACTION] No requests found for date ${searchDate} (Input: ${date})`
      )
      // این ارور خاص باعث می‌شود در تابع پدر، تلاش مجدد (Retry) انجام نشود
      return { success: false, error: `تراکنشی برای تاریخ ${date} یافت نشد.` }
    }

    // ✅ فیلتر کردن آیتم‌های مبلغ صفر (مانند فایل‌های آپلود شده)
    const validRequests = requests.filter(r => Number(r.amount) > 0)

    if (validRequests.length === 0) {
      console.warn(
        `⚠️ All transactions have 0 amount (probably uploads). Skipping.`
      )
      return { success: false, error: `تراکنش معتبری (با مبلغ) یافت نشد.` }
    }

    // 2. آماده‌سازی داده خام
    const totalAmount = validRequests.reduce(
      (sum, r) => sum + Number(r.amount),
      0
    )
    const typeFarsi = type === "deposit" ? "واریز" : "برداشت"

    const payload = {
      description: `سند تجمیعی ${typeFarsi} - مورخ ${date}`,
      mode: type,
      totalAmount: totalAmount,
      date: searchDate,
      workspaceId: workspaceId,
      bankDLCode: finalBankDL,
      items: validRequests.map(r => ({
        partyName: r.counterparty || r.supplier_name || "نامشخص",
        amount: Number(r.amount),
        // ✅ استفاده از تابع تمیزکننده شرح
        desc: generateCleanDescription(
          r.description || "",
          r.counterparty || r.supplier_name || "",
          type
        ),
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

    // 4. آپدیت دیتابیس (فقط برای آیتم‌های معتبر ارسال شده)
    const requestIds = validRequests.map(r => r.id)
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
      count: validRequests.length,
      totalAmount: totalAmount,
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
    console.log("🔍 AI Checking Invoice...")
    const aiResult = await analyzeInvoice(invoiceUrl)

    if (!aiResult.success) {
      // اگر هوش مصنوعی نتوانست بخواند، فعلا فقط وارنینگ می‌دهیم یا می‌توانیم رد کنیم
      console.warn("AI could not read invoice:", aiResult.error)
    } else {
      const invoiceAmount = Number(aiResult.data.total_amount) || 0
      const dbAmount = Number(request.amount) || 0

      // محاسبه اختلاف (مثلاً اگر اختلاف بیشتر از ۱۰۰۰ تومان بود خطا بده)
      const diff = Math.abs(invoiceAmount - dbAmount)

      if (invoiceAmount > 0 && diff > 50000) {
        // تلورانس ۵۰ هزار تومان
        return {
          success: false,
          approved: false,
          reason: `مبلغ فاکتور (${invoiceAmount.toLocaleString()}) با مبلغ واریزی (${dbAmount.toLocaleString()}) همخوانی ندارد.`
        }
      }
    }
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

    if (request.assigned_user_id) {
      const { data: officerProfile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", request.assigned_user_id)
        .single()

      if (officerProfile?.phone) {
        // متن: شماره سند X بسته شد
        await sendCompletionSMS(officerProfile.phone, partyName)
      }
    }

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
function sanitizeSql(text: string | null): string {
  if (!text) return ""
  // تبدیل ' به '' (استاندارد SQL Server)
  return text.replace(/'/g, "''")
}
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
  const safeDesc = sanitizeSql(params.description)

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
        DECLARE @DailyNumber INT; -- متغیر جدید برای شماره روزانه
        DECLARE @SLRef BIGINT, @GLRef BIGINT, @AccountGroupRef BIGINT;
        
        -- متغیرهای تفصیلی
        DECLARE @DLRef BIGINT = NULL, @DLTypeRef BIGINT = NULL;

        -- 1. پیدا کردن معین
        SELECT TOP 1 @SLRef = SLID, @GLRef = GLRef, @AccountGroupRef = (SELECT TOP 1 AccountGroupRef FROM [FIN3].[GL] WHERE GLID = SL.GLRef)
        FROM [FIN3].[SL] SL WHERE Code = @SLCode;

        IF @SLRef IS NULL THROW 51000, 'کد معین یافت نشد', 1;

        -- 2. پیدا کردن تفصیلی
        IF ${dlCodeValue} IS NOT NULL
        BEGIN
            SELECT TOP 1 @DLRef = DLID, @DLTypeRef = DLTypeRef 
            FROM [FIN3].[DL] WHERE Code = ${dlCodeValue};
            
            IF @DLRef IS NULL THROW 51000, 'کد تفصیلی انتخاب شده نامعتبر است', 1;
        END

        -- 3. هدر سند
        DECLARE @BranchRef BIGINT = 1, @LedgerRef BIGINT = 1, @UserRef INT = 1;
        DECLARE @VoucherTypeRef BIGINT = 30;
        DECLARE @FiscalYearRef BIGINT;
        SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] WHERE LedgerRef = @LedgerRef ORDER BY EndDate DESC;

        -- دریافت ID جدید
        EXEC [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;
        
        -- محاسبه شماره سند (کلی در سال)
        SELECT @VoucherNumber = ISNULL(MAX(Number), 0) + 1 
        FROM [FIN3].[Voucher] WITH (UPDLOCK, HOLDLOCK) 
        WHERE FiscalYearRef = @FiscalYearRef 
          AND LedgerRef = @LedgerRef 
          AND VoucherTypeRef = @VoucherTypeRef;

        -- ✅ محاسبه صحیح شماره روزانه (مخصوص همان روز)
        SELECT @DailyNumber = ISNULL(MAX(DailyNumber), 0) + 1 
        FROM [FIN3].[Voucher] WITH (UPDLOCK, HOLDLOCK) 
        WHERE FiscalYearRef = @FiscalYearRef 
          AND LedgerRef = @LedgerRef 
          AND BranchRef = @BranchRef
          AND Date = @Date;

       INSERT INTO [FIN3].[Voucher] (
            VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
            Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
            Description, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields, DailyNumber, Sequence
        ) VALUES (
            @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, @VoucherNumber,
            @Date, @VoucherTypeRef, @UserRef, GETDATE(), @UserRef, GETDATE(), 0,
            @Desc, 0, 0, 0, 0, @DailyNumber, @VoucherNumber
        );
        -- نکته: DailyNumber اصلاح شد (قبلاً @VoucherNumber بود)

        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherLock', @Id = @VoucherLockID OUTPUT;
        INSERT INTO [FIN3].[VoucherLock] (VoucherLockID, VoucherRef, UserRef, LastModificationDate) 
        VALUES (@VoucherLockID, @VoucherID, @UserRef, GETDATE());

        -- 4. آیتم طرف حساب
        DECLARE @ItemID1 BIGINT;
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @ItemID1 OUTPUT;
        
        INSERT INTO [FIN3].[VoucherItem] (
            VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
            Debit, Credit, Description, RowNumber, IsCurrencyBased,
            DLLevel4, DLTypeRef4
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

// اضافه کردن در app/actions/finance-actions.ts

export async function analyzeInvoice(fileUrl: string) {
  try {
    const fileRes = await fetch(fileUrl, { cache: "no-store" })
    if (!fileRes.ok) throw new Error("دانلود فایل ناموفق بود")

    const fileBuffer = await fileRes.arrayBuffer()
    const base64Data = Buffer.from(fileBuffer).toString("base64")
    const mimeType = fileUrl.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg"
    //net error
    const response = await openRouter.chat.send({
      model: "openai/gpt-5-mini", // مدل مناسب و سریع
      messages: [
        {
          role: "system",
          content:
            "You are an expert accountant AI. Extract the 'Total Amount' (مبلغ قابل پرداخت/جمع کل) and 'Seller Name' (فروشنده) from this invoice image/pdf. Return JSON only."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract data. Return JSON: { "total_amount": 123000, "seller_name": "string", "invoice_date": "YYYY/MM/DD" }. Ignore commas in numbers.`
            },
            {
              type: "image_url",
              imageUrl: { url: `data:${mimeType};base64,${base64Data}` }
            }
          ]
        }
      ],
      responseFormat: { type: "json_object" }
    })

    const content = response.choices[0].message.content as string
    const data = JSON.parse(content || "{}")

    return { success: true, data }
  } catch (error: any) {
    console.error("Invoice OCR Error:", error)
    return { success: false, error: error.message }
  }
}
