import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"
import {
  verifyNameMatch,
  detectFee,
  verifyWithAI,
  auditVoucherWithAI,
  INTERNAL_BANK_ACCOUNTS
} from "./bankIntelligence"

export interface RahkaranSyncResult {
  success: boolean
  docId?: string
  error?: string
  message?: string
  party?: string
  sl?: string
  processedTrackingCodes?: string[]
  results?: string[]
}

export interface FeeResult {
  isFee: boolean
  reason: string
}

const GENERIC_WORDS = new Set([
  "شرکت",
  "موسسه",
  "سازمان",
  "بازرگانی",
  "تولیدی",
  "صنعتی",
  "گروه",
  "خدمات",
  "فنی",
  "مهندسی",
  "تجاری",
  "عمومی",
  "تعاونی",
  "آقای",
  "خانم",
  "فروشگاه",
  "راه",
  "ساختمانی",
  "توسعه",
  "گسترش",
  "پیمانکاری",
  "مشاوره",
  "بین",
  "المللی",
  "سازه",
  "صنعت",
  "طرح",
  "اجرا",
  "نظارت",
  "تجهیزات",
  "مجتمع",
  "کارخانه",
  "راه و ساختمانی",
  "بانک",
  "شعبه",
  "کد",
  "نامشخص",
  "بنام",
  "به",
  "نام",
  "واریز",
  "چک",
  "بابت",
  "امور",
  "دفتر",
  "شیمیایی",
  "شیمی",
  "صنایع",
  "تولیدی",
  "پخش",
  "نوید",
  "گستر",
  "آریا",
  "برتر",
  "نوین",
  "سازه",
  "صنعت"
])
const FEE_KEYWORDS = [
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان", // با و بدون کلاه
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "خدمات بانکی",
  "کارمزد ساتنا",
  "کارمزد پایا",
  "عودت کارمزد  ساتنا/پایا",
  "عودت کارمزد",
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان",
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "خدمات بانکی",
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان",
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "خدمات بانکی",
  "ابطال چک",
  "عودت چک",
  "رفع سوء اثر",
  "کارمزد رفع سوء اثر",
  "صدور چک",
  "تمتی چک"
]

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

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

const AI_MODEL = "openai/gpt-5-mini"

function escapeSql(str: string | undefined | null): string {
  if (!str) return ""
  return str.toString().replace(/'/g, "''")
}

async function logToDb(level: string, message: string, data: any = null) {
  const timestamp = new Date().toLocaleTimeString()
  console.log(`[${level}] ${timestamp} ➤ ${message}`)
  try {
    supabase
      .from("Rhyno_DebugLog")
      .insert([
        {
          level,
          message,
          data: data ? JSON.stringify(data) : null
        }
      ])
      .then(() => {})
  } catch (e) {}
}

async function executeSql(sql: string) {
  const proxyRes = await fetch(PROXY_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY! },
    body: JSON.stringify({ query: sql })
  })
  const responseText = await proxyRes.text()
  let proxyData
  try {
    proxyData = JSON.parse(responseText)
  } catch (e) {
    throw new Error(`Proxy JSON Error: ${responseText.substring(0, 100)}`)
  }

  if (!proxyRes.ok || !proxyData.success) {
    throw new Error(`SQL Error: ${proxyData.error || proxyData.message}`)
  }
  return proxyData.recordset || []
}

export interface SyncPayload {
  mode: "deposit" | "withdrawal"
  date: string
  // ✅ نام فیلد را به 'description' یا 'docDescription' تغییر دهید.
  description: string
  // اگر 'normalizedDesc' را هم لازم دارید، آن را اختیاری یا حذف کنید
  // normalizedDesc?: string // یا اگر لازم است
  totalAmount: number
  branchId?: number
  workspaceId: string
  bankDLCode?: string | null
  items: {
    partyName: string
    amount: number
    desc?: string
    tracking?: string
  }[]
}
// اضافه کردن کلاینت سوپابیس در بالای فایل
const supabaseService = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b"

async function findAccountCode(partyName: string): Promise<{
  dlCode?: string
  dlType?: number
  slId?: number
  foundName: string
}> {
  let cleanName = partyName.replace(/Unknown/gi, "").trim()
  if (!cleanName || cleanName.length < 2) return { foundName: "نامشخص" }

  // 1. لیست کامل کلمات عمومی که باید حذف شوند تا به "نام اصلی" برسیم
  const extendedStopWords = [
    "شرکت",
    "مهندسی",
    "تولیدی",
    "بازرگانی",
    "صنعتی",
    "گروه",
    "آقای",
    "خانم",
    "فروشگاه",
    "موسسه",
    "تعاونی",
    "خدمات",
    "تجاری",
    "نامشخص",
    "عمومی",
    "خصوصی",
    "شیمیایی",
    "شیمی",
    "صنایع",
    "پخش",
    "نوید",
    "گستر",
    "سازه",
    "صنعت",
    "توسعه",
    "مجتمع",
    "کارخانه"
  ]

  let processedName = cleanName
  // حذف کلمات زائد
  extendedStopWords.forEach(word => {
    processedName = processedName.replace(new RegExp(word, "g"), "").trim()
  })

  // اگر بعد از حذف، چیزی نماند (مثلا اسمش فقط "شرکت شیمیایی" بوده)، از همان اسم اولیه استفاده کن
  if (processedName.length < 2) processedName = cleanName

  // ---------------------------------------------------------
  // 1. جستجوی وکتور (بدون تغییر)
  // ---------------------------------------------------------
  try {
    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanName.replace(/\s+/g, " ")
    })

    const embedding = embeddingRes.data[0].embedding
    const { data: matches } = await supabaseService.rpc(
      "match_rahkaran_entities",
      {
        query_embedding: embedding,
        match_threshold: 0.45,
        match_count: 3
      }
    )

    if (matches && matches.length > 0) {
      for (const best of matches) {
        if (verifyNameMatch(cleanName, best.title)) {
          console.log(
            `✅ Algo Verified Vector: "${cleanName}" => "${best.title}"`
          )
          return {
            dlCode: best.dl_code,
            dlType: best.dl_type,
            foundName: best.title
          }
        }
        if (best.similarity < 0.55) continue
        const isVerified = await verifyWithAI(cleanName, best.title)
        if (isVerified) {
          console.log(
            `✅ AI Verified Vector: "${cleanName}" => "${best.title}"`
          )
          return {
            dlCode: best.dl_code,
            dlType: best.dl_type,
            foundName: best.title
          }
        }
      }
    }
  } catch (e) {
    console.error("Vector search failed:", e)
  }

  // ---------------------------------------------------------
  // 2. جستجوی SQL (اصلاح شده و دقیق)
  // ---------------------------------------------------------
  console.log(
    `⚠️ Using SQL Fallback for: ${cleanName} (Core: ${processedName})`
  )

  // جدا کردن کلمات مهم (حداقل 2 حرف)
  const words = processedName.split(/\s+/).filter(w => w.length > 1)
  const w1 = words[0] || ""
  const w2 = words[1] || ""

  // نکته: اگر w1 خالی بود، از خود cleanName استفاده کن
  const searchW1 = w1 || cleanName.split(" ")[0]

  const sqlSearch = `
    SET NOCOUNT ON;
    DECLARE @RawName nvarchar(500) = N'${escapeSql(cleanName)}';
    DECLARE @W1 nvarchar(100) = N'${escapeSql(searchW1)}';
    DECLARE @W2 nvarchar(100) = N'${escapeSql(w2)}';
    
    -- نرمال سازی حروف فارسی (ی و ک)
    SET @RawName = REPLACE(REPLACE(@RawName, N'ي', N'ی'), N'ك', N'ک');
    SET @W1 = REPLACE(REPLACE(@W1, N'ي', N'ی'), N'ك', N'ک');
    SET @W2 = REPLACE(REPLACE(@W2, N'ي', N'ی'), N'ك', N'ک');
    
    DECLARE @LikeName nvarchar(500) = REPLACE(@RawName, N' ', N'%');

    SELECT TOP 3 Code, DLTypeRef, Title, Score
    FROM (
        SELECT TOP 10 Code, DLTypeRef, Title,
            (
                (CASE WHEN CleanTitle = @RawName THEN 1000 ELSE 0 END) + -- تطابق دقیق کامل
                (CASE WHEN CleanTitle LIKE N'%'+ @LikeName +'%' THEN 500 ELSE 0 END) + -- تطابق با فاصله
                -- اگر دو کلمه داریم، هر دو باید باشند (امتیاز بسیار بالا برای چسب + پارس)
                (CASE WHEN @W1 <> '' AND @W2 <> '' AND CleanTitle LIKE N'%'+ @W1 +'%' AND CleanTitle LIKE N'%'+ @W2 +'%' THEN 800 ELSE 0 END) +
                -- امتیاز تکی
                (CASE WHEN @W1 <> '' AND CleanTitle LIKE N'%'+ @W1 +'%' THEN 50 ELSE 0 END)
            ) as Score
        FROM (
            SELECT Code, DLTypeRef, Title, 
                REPLACE(REPLACE(Title, N'ي', N'ی'), N'ك', N'ک') as CleanTitle
            FROM [FIN3].[DL]
            WHERE 
            (
                -- شرط جستجو: اگر دو کلمه مهم داریم، سعی کن هر دو را پیدا کنی، وگرنه اولی را پیدا کن
                (@W2 <> '' AND REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @W1 +'%' AND REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @W2 +'%')
                OR
                (@W2 = '' AND REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @W1 +'%')
                OR
                -- فال‌بک نهایی: جستجوی کلی
                (REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @LikeName +'%')
            )
        ) as T 
    ) as BestMatch
    WHERE Score >= 50
    ORDER BY Score DESC, LEN(Title) ASC; -- کوتاه‌ترین عنوان معمولاً دقیق‌ترین است
  `

  const res = await executeSql(sqlSearch)

  if (res && res.length > 0) {
    for (const row of res) {
      if (verifyNameMatch(cleanName, row.Title)) {
        console.log(`✅ Algo Verified SQL: "${cleanName}" => "${row.Title}"`)
        return { dlCode: row.Code, dlType: row.DLTypeRef, foundName: row.Title }
      }

      const isVerified = await verifyWithAI(cleanName, row.Title)
      if (isVerified) {
        console.log(`✅ AI Verified SQL: "${cleanName}" => "${row.Title}"`)
        return { dlCode: row.Code, dlType: row.DLTypeRef, foundName: row.Title }
      }
    }
  }

  // جستجوی معین (تلاش نهایی)
  const slSql = `
     SELECT TOP 1 SLID, Title FROM [FIN3].[SL] 
     WHERE Title LIKE N'%${escapeSql(searchW1)}%' 
     AND CAST(SLID AS VARCHAR(50)) NOT IN (N'111003', N'111005') 
     AND Code NOT LIKE '111%'
  `
  const slRes = await executeSql(slSql)
  const slRow = slRes[0] || {}

  return {
    slId: slRow.SLID,
    foundName: slRow.Title || "نامشخص"
  }
}

async function humanizenormalizedDesc(
  rawDesc: string,
  partyName: string,
  type: "deposit" | "withdrawal"
): Promise<string> {
  try {
    if (!rawDesc) return `بابت ${partyName}`
    const prompt = `
    You are a professional Iranian accountant. Rewrite the following transaction normalizedDesc into a formal Farsi accounting string.
    Input: "${rawDesc}"
    Party: "${partyName}"
    Type: ${type === "deposit" ? "واریز" : "برداشت"}
    Rules: Remove "robot", "automated". Use terms like "بابت", "طی فیش", "حواله". Keep tracking codes. Output ONLY Farsi.
    `
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 100
    })
    return response.choices[0]?.message?.content?.trim() || rawDesc
  } catch (e) {
    return `بابت ${partyName} - ${rawDesc}`
  }
}

// ---------------------------------------------------------
// 2. تولید شرح هدر سند (جدید: برای حل مشکل هدر) 🧠
// ---------------------------------------------------------
async function generateHumanHeader(date: string): Promise<string> {
  try {
    const prompt = `
    Generate a short, professional accounting voucher header in Persian (Farsi) for daily bank transactions.
    Date: ${date}
    Context: A mix of deposits and withdrawals.
    Rules: 
    - Do NOT use words like "مکانیزه", "ربات", "سیستمی", "هوش مصنوعی".
    - Use varied styles like: "ثبت گردش عملیات بانکی مورخ ...", "سند روزانه بانک ...", "گردش وجوه نقد ...".
    - Output ONLY the Farsi string.
    `
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7, // کمی خلاقیت برای تنوع
      max_tokens: 60
    })
    return (
      response.choices[0]?.message?.content?.trim() ||
      `گردش عملیات بانکی مورخ ${date}`
    )
  } catch (e) {
    return `گردش عملیات بانکی مورخ ${date}`
  }
}

// تابع جدید برای پیدا کردن کد تفصیلی از روی شماره حساب موجود در متن
async function findBankDLByAccountNum(
  normalizedDesc: string
): Promise<any | null> {
  // این ریجکس اعدادی مثل 1-6116111-850-1021 یا 1021.2.611... را پیدا می‌کند
  const accountRegex = /(\d{1,4}[-.\/]\d+[-.\/]\d+[-.\/]?\d*)/g
  const matches = normalizedDesc.match(accountRegex)

  if (!matches || matches.length === 0) return null

  for (const rawNum of matches) {
    // حذف جداکننده‌ها برای جستجوی تمیز در دیتابیس
    const cleanNum = rawNum.replace(/[-.\/]/g, "")

    // جستجو در دیتابیس: آیا تفصیلی‌ای داریم که عنوانش شامل این عدد باشد؟
    // معمولا در عنوان تفصیلی بانک‌ها شماره حساب ذکر می‌شود
    const sql = `
      SELECT TOP 1 Code, Title, DLTypeRef 
      FROM [FIN3].[DL] 
      WHERE REPLACE(REPLACE(REPLACE(Title, '-', ''), '.', ''), '/', '') LIKE N'%${escapeSql(cleanNum)}%'
      AND (Title LIKE N'%بانک%' OR Title LIKE N'%سپرده%' OR Title LIKE N'%جاری%')
    `

    try {
      const res = await executeSql(sql)
      if (res && res.length > 0) {
        console.log(
          `✅ Found Bank DL from normalizedDesc: ${rawNum} => ${res[0].Code}`
        )
        return {
          Code: res[0].Code,
          Title: res[0].Title,
          DLTypeRef: res[0].DLTypeRef,
          source: "normalizedDesc Account Match"
        }
      }
    } catch (e) {
      console.error("Error finding bank DL:", e)
    }
  }
  return null
}

function normalizePersianNumbers(str: string): string {
  return str
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
}

async function smartAccountFinder(
  partyName: string,
  description: string,
  amount: number,
  mode: "deposit" | "withdrawal"
): Promise<{
  dlCode?: string
  dlType?: number
  slId?: number
  foundName: string
  isFee?: boolean
  reason?: string
}> {
  const cleanName = partyName.replace(/Unknown|نامشخص/gi, "").trim()
  const normalizedDesc = normalizePersianNumbers(description)

  // ✅ اصلاح مهم: حذف فاصله‌ها برای تشخیص بهتر شماره حساب (مثلاً 0104 813...)
  const cleanDescriptionForSearch = normalizedDesc.replace(/[-.\/\s]/g, "")
  const isSmallAmount = amount < 1000000

  // 1. تشخیص کارمزد
  const hasFeeKeyword = FEE_KEYWORDS.some(k => normalizedDesc.includes(k))
  if (hasFeeKeyword && isSmallAmount) {
    return {
      foundName: "هزینه بانکی",
      isFee: true,
      reason: "تشخیص کلمات کلیدی کارمزد"
    }
  }

  let candidates: any[] = []

  // 2. جستجوی حساب‌های بانکی (استفاده از لیست مرکزی)
  // این بخش مشکل سند 52 (آذریورد) را حل می‌کند
  for (const acc of INTERNAL_BANK_ACCOUNTS) {
    for (const key of acc.keywords) {
      const cleanKey = key.replace(/[-.\/\s]/g, "") // حذف فاصله از کلید هم
      if (cleanDescriptionForSearch.includes(cleanKey)) {
        candidates.push({
          Code: acc.dl,
          Title: acc.title,
          source: "Detected Account Number"
        })
        // وقتی پیدا شد، بریک کن که تکراری نشه
        break
      }
    }
  }

  // 3. جستجوی ویژه برای اشخاص (حل مشکل Unknown شدن امین‌نیا)
  const personMatch = normalizedDesc.match(/توسط\s+([\u0600-\u06FF\s]+)/)
  if (personMatch && personMatch[1]) {
    const extractedPersonName = personMatch[1]
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ")
    if (extractedPersonName.length > 3) {
      try {
        const embeddingRes = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: extractedPersonName
        })
        const { data: personMatches } = await supabaseService.rpc(
          "match_rahkaran_entities",
          {
            query_embedding: embeddingRes.data[0].embedding,
            match_threshold: 0.4,
            match_count: 3
          }
        )
        if (personMatches)
          candidates.push(
            ...personMatches.map((m: any) => ({
              ...m,
              source: "Extracted Person Name Match"
            }))
          )
      } catch (e) {}
    }
  }

  // 4. جستجوی عادی (نام طرف حساب و شرح)
  if (cleanName.length > 2) {
    try {
      const embeddingRes = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: cleanName
      })
      const { data: nameMatches } = await supabaseService.rpc(
        "match_rahkaran_entities",
        {
          query_embedding: embeddingRes.data[0].embedding,
          match_threshold: 0.4,
          match_count: 5
        }
      )
      if (nameMatches)
        candidates.push(
          ...nameMatches.map((m: any) => ({ ...m, source: "Name Match" }))
        )
    } catch (e) {}
  }

  // حذف تکراری‌ها
  const uniqueCandidates = Array.from(
    new Map(candidates.map(item => [item.Code || item.dl_code, item])).values()
  )

  // 5. تصمیم‌گیری نهایی با هوش مصنوعی
  const prompt = `
  You are an expert Chief Accountant. Map this transaction to the correct DL Code.
  
  Transaction:
  - Type: ${mode}
  - Amount: ${amount} IRR
  - Input Name: "${partyName}"
  - Description: "${normalizedDesc}"

  Candidates Found:
  ${JSON.stringify(
    uniqueCandidates.map(c => ({
      code: c.Code || c.dl_code,
      name: c.Title || c.title,
      source: c.source
    })),
    null,
    2
  )}

  DECISION RULES (Priority 1 is Highest):
  
  1. **PERSONAL WITHDRAWAL (SUPER PRIORITY):** - IF description contains "توسط" (by) followed by a Person's Name (e.g. "Amin..."):
     - **SELECT THAT PERSON** from candidates.
     - **IGNORE** any bank account numbers or "Transfer" keywords.

  2. **NAME MATCH (Commercial):**
     - IF Input Name matches a Candidate Name (fuzzy match):
     - **SELECT THAT CANDIDATE**.
     - **IGNORE** bank transfer details.

  3. **INTERNAL BANK TRANSFER:** - IF Rule #1 & #2 are NOT met, AND description contains an Account Number match (source='Detected Account Number'):
     - Select the **BANK** candidate.

  4. **Fees:** - If small amount (< 5M IRR) and desc has "کارمزد"/"چک".

  Output JSON: { "decision": "SELECTED_CODE" | "IS_FEE" | "UNKNOWN", "code": "...", "name": "...", "reason": "..." }
  `

  try {
    const aiResponse = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: "Output JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.0,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(aiResponse.choices[0].message.content || "{}")
    console.log("🧠 AI Decision:", result)

    if (result.decision === "IS_FEE") {
      return { foundName: "هزینه بانکی", isFee: true, reason: result.reason }
    }

    if (result.decision === "SELECTED_CODE" && result.code) {
      const selectedCandidate = uniqueCandidates.find(
        c => (c.Code || c.dl_code) == result.code
      )
      let dlType = selectedCandidate?.DLTypeRef || selectedCandidate?.dl_type
      return {
        dlCode: result.code,
        dlType: dlType,
        foundName: result.name,
        isFee: false,
        reason: result.reason
      }
    }
  } catch (e) {
    console.error("AI Decision Failed:", e)
  }

  return { foundName: "نامشخص", isFee: false, reason: "عدم تشخیص قطعی" }
}

export async function syncToRahkaranSystem(
  payload: SyncPayload
): Promise<RahkaranSyncResult> {
  try {
    console.log("\n---------------------------------------------------")
    console.log("🚀 STARTING PIPELINE (ACCURATE ACCOUNTANT)")
    console.log("---------------------------------------------------")
    const successfulTrackingCodes: string[] = []

    const { mode, items, bankDLCode } = payload
    const isDeposit = mode === "deposit"
    const resultsTable = []
    const FIXED_BANK_DL = bankDLCode

    const FIXED_LEDGER_ID = 1
    const FIXED_BANK_SL = "111005"
    const DEPOSIT_SL_CODE = "211002"
    const WITHDRAWAL_SL_CODE = "111901"

    const debugDecisions = []
    const safeDate = payload.date
    const jalaliDate =
      payload.description?.match(/\d{4}\/\d{2}\/\d{2}/)?.[0] || safeDate
    const headernormalizedDesc = await generateHumanHeader(jalaliDate)
    const safeHeaderDesc = escapeSql(headernormalizedDesc)

    let sqlItemsBuffer = ""
    let validItemsCount = 0
    let currentRowIndex = 1

    for (const item of items) {
      if (!item.amount || item.amount === 0) {
        console.warn(`⚠️ Skipped item with zero amount: ${item.desc}`)
        continue
      }
      const partyName = item.partyName || "نامشخص"
      const rawDesc = item.desc || ""

      const humanDesc = await humanizenormalizedDesc(
        rawDesc,
        partyName,
        mode as any
      )
      const safeDesc = escapeSql(humanDesc)

      // 2. اجرا موتور هوشمند
      const decision = await smartAccountFinder(
        partyName,
        rawDesc,
        item.amount,
        mode as any
      )

      // 3. ممیزی نهایی
      const auditParams = {
        inputName: partyName,
        inputDesc: rawDesc,
        amount: item.amount,
        selectedAccountName: decision.foundName,
        selectedAccountCode: decision.dlCode || null,
        selectedSLCode: decision.isFee
          ? "621105"
          : decision.dlCode === "111106"
            ? "111106"
            : isDeposit
              ? DEPOSIT_SL_CODE
              : WITHDRAWAL_SL_CODE,
        isFee: decision.isFee || false
      }

      const auditResult = await auditVoucherWithAI(auditParams)

      if (!auditResult.approved) {
        console.warn(`❌ Audit Rejected: ${auditResult.reason}`)
        decision.dlCode = undefined
        decision.isFee = false
        decision.foundName = "نامشخص (رد شده توسط ناظر)"
        decision.reason = auditResult.reason
      }

      debugDecisions.push({
        OriginalName: partyName,
        Amount: item.amount,
        Context: rawDesc.substring(0, 30) + "...",
        Decision: decision.isFee
          ? "هزینه بانکی"
          : decision.dlCode
            ? `کد: ${decision.dlCode}`
            : "نامشخص",
        MappedName: decision.foundName,
        Reason: decision.reason
      })

      successfulTrackingCodes.push(item.tracking || "")

      // لاجیک تعیین معین
      // لاجیک تعیین معین
      let finalSL = isDeposit ? DEPOSIT_SL_CODE : WITHDRAWAL_SL_CODE

      if (decision.isFee) {
        finalSL = "621105" // هزینه مالی
      } else if (decision.dlCode === "111106") {
        finalSL = "111106" // کد معین انسداد
      }
      // ✅ شرط جدید: اگر کد تفصیلی با 200 شروع شود (یعنی بانک است) یا اسمش "بانک" باشد
      else if (
        decision.dlCode?.startsWith("200") ||
        decision.foundName.includes("بانک")
      ) {
        // این کد (111005) همان "موجودی بانکهای ریالی" است.
        // با انتخاب این معین، سیستم راهکاران خودکار گروه "دارایی جاری" و کل "نقد و بانک" را انتخاب می‌کند.
        finalSL = "111005"
        console.log(
          `🏦 Bank-to-Bank detected: Forcing SL to ${finalSL} for DL ${decision.dlCode}`
        )
      }

      const dlValue =
        decision.dlCode && decision.dlCode !== "111106"
          ? `N'${decision.dlCode}'`
          : "NULL"
      // اگر کد انسداد بود، چون تفصیلی ندارد (فرضاً)، تفصیلی را نال می‌گذاریم (یا اگر تفصیلی است پر کنید)

      sqlItemsBuffer += `
        -- Item: ${escapeSql(partyName)} (${decision.foundName})
        SET @Amount = ${item.amount};
        SET @Desc = N'${safeDesc}';
        
     SET @Str_PartySLCode = N'${finalSL}'; 
        SET @Str_PartyDLCode = ${dlValue}; 
        SET @Str_BankSLCode = N'${FIXED_BANK_SL}'; 
        SET @Str_BankDLCode = N'${FIXED_BANK_DL}';

        -- A. تنظیمات طرف حساب
        SET @Ref_SL = NULL; 
        SELECT TOP 1 @Ref_SL = SLID, @Ref_GL = GLRef FROM [FIN3].[SL] WHERE Code = @Str_PartySLCode;
        
        -- فال‌بک برای معین (اگر پیدا نشد)
        IF @Ref_SL IS NULL 
           SELECT TOP 1 @Ref_SL = SLID, @Ref_GL = GLRef FROM [FIN3].[SL] 
           WHERE Code = CASE WHEN ${isDeposit ? 1 : 0} = 1 THEN '${DEPOSIT_SL_CODE}' ELSE '${WITHDRAWAL_SL_CODE}' END;
           
        SELECT TOP 1 @Ref_AccountGroup = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @Ref_GL;

        SET @Ref_DL = NULL; SET @Ref_DLType = NULL; 
        
        -- ✅ اصلاح مهم: مقدار پیش‌فرض را ۴ می‌گذاریم و پاکش نمی‌کنیم
        SET @Var_DLLevel = 4; 
SET @RealLevel = NULL;
  IF @Str_PartyDLCode IS NOT NULL
BEGIN
     SELECT TOP 1 @Ref_DL = DLID, @Ref_DLType = DLTypeRef FROM [FIN3].[DL] WHERE Code = @Str_PartyDLCode;
     
     -- استفاده از متغیر سراسری (بدون DECLARE)
     SELECT TOP 1 @RealLevel = [Level] FROM [FIN3].[DLTypeRelation] WHERE SLRef = @Ref_SL AND DLTypeRef = @Ref_DLType;
     
     IF @RealLevel IS NOT NULL 
        SET @Var_DLLevel = @RealLevel;
END

        -- B. تنظیمات بانک
        SET @Ref_BankSL = NULL; 
        SELECT TOP 1 @Ref_BankSL = SLID, @Ref_BankGL = GLRef FROM [FIN3].[SL] WHERE Code = @Str_BankSLCode;
        SELECT TOP 1 @Ref_BankAccountGroup = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @Ref_BankGL;
        
        SET @Ref_BankDL = NULL; SET @Ref_BankDLType = NULL;
        SELECT TOP 1 @Ref_BankDL = DLID, @Ref_BankDLType = DLTypeRef FROM [FIN3].[DL] WHERE Code = @Str_BankDLCode;

        -- C. ثبت ردیف طرف حساب
      EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @VoucherItemID OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
             VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef, Debit, Credit, Description, RowNumber, IsCurrencyBased, -- ✅ اینجا normalizedDesc بود که شد Description
             DLLevel4, DLTypeRef4, DLLevel5, DLTypeRef5, DLLevel6, DLTypeRef6
        ) VALUES (
             @VoucherItemID, @VoucherID, @BranchRef, @Ref_SL, CAST(@Str_PartySLCode AS NVARCHAR(50)), @Ref_GL, @Ref_AccountGroup, ${isDeposit ? "0" : "@Amount"}, ${isDeposit ? "@Amount" : "0"}, @Desc, ${currentRowIndex}, 0,
             CASE WHEN @Var_DLLevel = 4 THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 4 THEN @Ref_DLType ELSE NULL END,
             CASE WHEN @Var_DLLevel = 5 THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 5 THEN @Ref_DLType ELSE NULL END,
             CASE WHEN @Var_DLLevel = 6 THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 6 THEN @Ref_DLType ELSE NULL END
        );

        -- D. ثبت ردیف بانک
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @VoucherItemID OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
             VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef, Debit, Credit, Description, RowNumber, IsCurrencyBased,
             DLLevel4, DLTypeRef4, DLLevel5, DLTypeRef5, DLLevel6, DLTypeRef6
        ) VALUES (
             @VoucherItemID, @VoucherID, @BranchRef, @Ref_BankSL, CAST(@Str_BankSLCode AS NVARCHAR(50)), @Ref_BankGL, @Ref_BankAccountGroup, ${isDeposit ? "@Amount" : "0"}, ${isDeposit ? "0" : "@Amount"}, @Desc, ${currentRowIndex + 1}, 0,
             CAST(@Str_BankDLCode AS NVARCHAR(50)), @Ref_BankDLType, NULL, NULL, NULL, NULL
        );
      `

      currentRowIndex += 2
      validItemsCount++
      resultsTable.push({ Name: partyName, Result: "Batched 🟢" })
    }

    if (validItemsCount > 0) {
      console.log(
        "📋 DECISION REPORT JSON:",
        JSON.stringify(debugDecisions, null, 2)
      )

      const finalSql = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @RetryCount INT = 0;
      DECLARE @Success BIT = 0;
      DECLARE @ErrorMessage NVARCHAR(4000);
      DECLARE @RealLevel INT;
      DECLARE @VoucherID BIGINT;
      DECLARE @FiscalYearRef BIGINT;
      DECLARE @VoucherNumber BIGINT; 
      DECLARE @RefNumStr NVARCHAR(50);
      DECLARE @DailyNumber INT;
      DECLARE @Sequence BIGINT;
      DECLARE @RetVal INT;

      DECLARE @BranchRef BIGINT; 
      DECLARE @LedgerRef BIGINT = ${FIXED_LEDGER_ID};
      DECLARE @VoucherTypeRef BIGINT = 30;
      DECLARE @UserRef INT = 1; 
      DECLARE @Date NVARCHAR(20) = N'${safeDate}';
      
      DECLARE @Amount DECIMAL(18,0);
      DECLARE @Desc NVARCHAR(MAX);
      DECLARE @Str_PartySLCode NVARCHAR(50); 
      DECLARE @Str_PartyDLCode NVARCHAR(50);
      DECLARE @Str_BankSLCode NVARCHAR(50); 
      DECLARE @Str_BankDLCode NVARCHAR(50); 
      DECLARE @Ref_SL BIGINT, @Ref_GL BIGINT, @Ref_AccountGroup BIGINT;
      DECLARE @Ref_BankSL BIGINT, @Ref_BankGL BIGINT, @Ref_BankAccountGroup BIGINT;
      DECLARE @Ref_DL BIGINT, @Ref_DLType BIGINT, @Var_DLLevel INT;
      DECLARE @Ref_BankDL BIGINT, @Ref_BankDLType BIGINT;
      DECLARE @VoucherItemID BIGINT;

      BEGIN TRY
            BEGIN TRANSACTION;

            SELECT TOP 1 @BranchRef = BranchID FROM [GNR3].[Branch];
            IF @BranchRef IS NULL THROW 51000, 'Error: No Branch found.', 1;

            SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] 
            WHERE LedgerRef = @LedgerRef AND StartDate <= @Date AND EndDate >= @Date;
            IF @FiscalYearRef IS NULL 
               SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] WHERE LedgerRef = @LedgerRef ORDER BY EndDate DESC;

            SELECT @VoucherNumber = ISNULL(MAX(Number), 0) + 1
            FROM [FIN3].[Voucher] WITH (UPDLOCK, HOLDLOCK) 
            WHERE FiscalYearRef = @FiscalYearRef 
              AND LedgerRef = @LedgerRef 
              AND VoucherTypeRef = @VoucherTypeRef;

            IF @VoucherNumber IS NULL SET @VoucherNumber = 1;

            SET @Sequence = @VoucherNumber;
            SET @RefNumStr = CAST(@VoucherNumber AS NVARCHAR(50));

            WHILE EXISTS (
                SELECT 1 FROM [FIN3].[Voucher] 
                WHERE FiscalYearRef = @FiscalYearRef AND LedgerRef = @LedgerRef
                  AND (ReferenceNumber = @RefNumStr OR Sequence = @Sequence)
            )
            BEGIN
                SET @VoucherNumber = @VoucherNumber + 1;
                SET @Sequence = @VoucherNumber;
                SET @RefNumStr = CAST(@VoucherNumber AS NVARCHAR(50));
            END
           SELECT @DailyNumber = ISNULL(MAX(DailyNumber), 0) + 1 
            FROM [FIN3].[Voucher] WITH (UPDLOCK, HOLDLOCK) 
            WHERE LedgerRef = @LedgerRef 
              AND BranchRef = @BranchRef 
              AND Date = @Date;

            
            WHILE EXISTS (
                SELECT 1 FROM [FIN3].[Voucher] 
                WHERE LedgerRef = @LedgerRef 
                  AND BranchRef = @BranchRef
                  AND Date = @Date 
                  AND DailyNumber = @DailyNumber
            )
            BEGIN
                SET @DailyNumber = @DailyNumber + 1;
            END

            EXEC @RetVal = [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;

          INSERT INTO [FIN3].[Voucher] (
                  VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
                  Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
                  Description, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields, -- ✅ اصلاح شد: normalizedDesc حذف شد
                  DailyNumber, Sequence, ReferenceNumber, IsReadonly, AuxiliaryNumber
            ) VALUES (
                  @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, 
                  @VoucherNumber, @Date, @VoucherTypeRef, 
                  @UserRef, GETDATE(), @UserRef, GETDATE(), 0,
                  N'${safeHeaderDesc}', 0, 0, 0, 0, -- ✅ اصلاح شد: مقادیر اضافی حذف شدند
                  @DailyNumber, @Sequence, @RefNumStr, 0, N''
            );

            ${sqlItemsBuffer}

            UPDATE [FIN3].[Voucher] SET State = 1 WHERE VoucherID = @VoucherID;

            COMMIT TRANSACTION;
            SELECT 'Success' AS Status, @VoucherNumber AS VoucherNum;

      END TRY
      BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            SET @ErrorMessage = ERROR_MESSAGE();
            THROW 51000, @ErrorMessage, 1;
      END CATCH
      `

      const sqlRes = await executeSql(finalSql)

      if (sqlRes && sqlRes[0] && sqlRes[0].Status === "Success") {
        const voucherNum = sqlRes[0].VoucherNum
        console.log(`🎉 SUCCESS! Voucher Created: #${voucherNum}`)

        return {
          success: true,
          docId: voucherNum.toString(),
          message: `سند با شماره ${voucherNum} با موفقیت ثبت شد.`,
          processedTrackingCodes: successfulTrackingCodes
        }
      } else {
        throw new Error(
          sqlRes && sqlRes[0] ? sqlRes[0].ErrMsg : "خطای SQL ناشناخته"
        )
      }
    }

    return { success: true, message: "No Items Matched", results: [] }
  } catch (error: any) {
    console.error("🔥 FATAL:", error)
    return { success: false, error: error.message }
  }
}
