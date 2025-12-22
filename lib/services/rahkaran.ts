import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"
import {
  verifyNameMatch,
  detectFee,
  verifyWithAI,
  auditVoucherWithAI,
  INTERNAL_BANK_ACCOUNTS,
  recoverBankFromDescription,
  detectBankInfoByNumber,
  findSmartRule,
  extractCounterpartyBankWithAI
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

const SPECIAL_OVERRIDES = [
  {
    // ✅ قانون عمومی: هر جا "حسن انجام کار" بود -> معین ۱۱۱۳۱۱
    keywords: [
      "حسن انجام کار",
      "سپرده حسن",
      "وجه نقد ضمانتنامه",
      "وجه نقد ضمان"
    ],
    slCode: "111311",
    title: "سپرده حسن انجام کار (عمومی)",
    dlCode: null // تفصیلی را نال می‌گذاریم تا بعداً شاید سیستم بتواند پروژه را پیدا کند یا دستی ست شود
  },
  {
    // قانون خاص چیتگر (اگر هنوز نیاز است تفصیلی خاصی داشته باشد)
    keywords: ["مجتمع چیتگر", "دادور"],
    slCode: "111311",
    title: "سپرده حسن انجام کار - مجتمع چیتگر",
    dlCode: null
  }
]

const PETTY_CASH_HOLDERS = [
  "امین امین نیا",
  "امین امین‌نیا", // با نیم‌فاصله
  "ایرج امین نیا",
  "ایرج امین‌نیا"
]

const TRANSFER_TRIGGERS = [
  "انتقال",
  "انتقالی",
  "جبران رسوب",
  "جبران",
  "آذریورد",
  "آذر یورد",
  "اذربورد",
  "آذربورد",
  "آذر بورد",
  "اذر بورد",
  "اذریورد",
  "اذر یورد",
  "آذر",
  "اذر",
  "ساتنا به حساب شرکت",
  "به نام اراه و ساختمانی آذر"
]

const STRICT_FEE_KEYWORDS = [
  "تمبر",
  "ضمانت نامه",
  "ضمانتنامه",
  "صدور ضمان",
  "کارمزد",
  "آبونمان",
  "ابونمان",
  "هزینه",
  "ابطال",
  "عودت چک",
  "دسته چک",
  "حق اشتراک",
  "ضمان"
]

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
  "تمبرضمان",
  "تمبر ضمان",
  "ضمان",
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
    "HTTP-Referer": "https://rhynoai.ir",
    "X-Title": "Rhyno Automation"
  }
})

const AI_MODEL = "google/gemini-2.5-flash"

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

export async function findAccountCode(partyName: string): Promise<{
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

// این تابع را به فایل rahkaran.ts اضافه کنید
// در فایل rahkaran.ts

async function findStrictAccountBySQL(partyName: string): Promise<{
  dlCode: string
  dlType: number
  foundName: string
} | null> {
  // 1. اگر نام "نامشخص" بود، اصلا نگرد (چون فایده‌ای ندارد)
  if (partyName.includes("نامشخص") || partyName.includes("Unknown")) {
    return null
  }

  // تمیزکاری اولیه: حذف کلمات اضافه
  let clean = partyName
    .replace(/توسط|به نام|در وجه|بابت|آقای|خانم|شرکت|فروشگاه/g, " ")
    .trim()

  // کلمات را جدا کن و فقط کلمات بیشتر از 2 حرف را نگه دار
  const words = clean.split(/\s+/).filter(w => w.length > 2)

  if (words.length === 0) return null

  // ساخت کوئری داینامیک
  const likeConditions = words
    .map(w => `Title LIKE N'%${escapeSql(w)}%'`)
    .join(" AND ")

  // 🛠 اصلاح شده: حذف شرط Status = 1
  const sql = `
    SELECT TOP 1 Code, Title, DLTypeRef 
    FROM [FIN3].[DL] 
    WHERE (${likeConditions})
  `

  try {
    const res = await executeSql(sql)
    if (res && res.length > 0) {
      console.log(
        `✅ Strict SQL Match Found: "${partyName}" => "${res[0].Title}"`
      )
      return {
        dlCode: res[0].Code,
        dlType: res[0].DLTypeRef,
        foundName: res[0].Title
      }
    }
  } catch (e) {
    console.error("Strict SQL Search Error:", e)
  }
  return null
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

// --- اضافه کردن به فایل rahkaran.ts ---

// --- 1. تابع پیش‌بینی هوشمند معین (Semantic AI) ---
async function predictSLWithAI(
  description: string,
  partyName: string,
  amount: number,
  isDeposit: boolean
): Promise<string | null> {
  try {
    const { data: candidates } = await supabaseService
      .from("rahkaran_accounts")
      .select("code, title")
      .eq("account_type", "SL")

    if (!candidates || candidates.length === 0) return null

    const prompt = `
    You are a Senior Financial Accountant. Your goal is to select the correct Subsidiary Ledger (SL) code for a transaction based on its description and direction (Deposit/Withdrawal).

    Transaction Details:
    - Description: "${description}"
    - Counterparty: "${partyName}"
    - Amount: ${amount}
    - Type: ${isDeposit ? "DEPOSIT (Credit/بستانکار)" : "WITHDRAWAL (Debit/بدهکار)"}

    Available SL Codes:
    ${JSON.stringify(candidates.map(c => `${c.code}: ${c.title}`).join("\n"))}

    Instructions:
    1. **Analyze the nature:** Is it an Expense (Debit), Income (Credit), Asset Purchase, or Liability/Deposit (Soperde)?
    2. **Context Matching:** - "Mouse/Keyboard" -> Office Supplies/Assets (Assets)
       - "Lunch/Food" -> Personnel/Reception Expenses (Expenses)
       - "Guarantee/Hassan Anjam Kar" -> Performance Deposit (Liabilities/Assets)
       - "Charge/Tan-khah" -> Petty Cash
    3. **Select Best Match:** Return the exact Code.

    Output JSON ONLY: { "selected_code": "..." | null }
    `

    const aiRes = await openai.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const result = JSON.parse(aiRes.choices[0].message.content || "{}")
    if (result.selected_code) {
      console.log(
        `🧠 AI Semantic Match: "${description}" (${isDeposit ? "Dep" : "Wdr"}) => ${result.selected_code}`
      )
      return result.selected_code
    }
    return null
  } catch (e) {
    console.error("AI Semantic Error:", e)
    return null
  }
}

// --- جایگزین تابع قبلی در rahkaran.ts ---

async function findFallbackSL(
  rawDesc: string,
  partyName: string,
  amount: number,
  isDeposit: boolean
): Promise<string> {
  const cleanDesc = rawDesc.replace(/[0-9]/g, "").trim()

  // ---------------------------------------------------------
  // گام ۱: جستجوی سریع کلمات کلیدی (Database Keywords)
  // ---------------------------------------------------------
  const { data: slRules } = await supabaseService
    .from("rahkaran_accounts")
    .select("code, match_keywords")
    .eq("account_type", "SL")
    .not("match_keywords", "is", null)

  if (slRules) {
    for (const rule of slRules) {
      if (!rule.match_keywords) continue
      for (const keyword of rule.match_keywords) {
        if (cleanDesc.includes(keyword)) {
          console.log(
            `⚡️ DB Keyword Match: Found SL "${rule.code}" via keyword "${keyword}"`
          )
          return rule.code
        }
      }
    }
  }

  // ---------------------------------------------------------
  // گام ۲: هوش مصنوعی (Semantic AI Search)
  // اینجا مشکل "موس" حل می‌شود!
  // ---------------------------------------------------------
  // فقط برای مبالغ برداشت (چون واریزها معمولا مشخص‌ترند، ولی می‌توانید شرط را بردارید)
  if (!isDeposit) {
    console.log(
      `🤔 Keywords failed for "${cleanDesc}". Asking AI for semantic match...`
    )
    const aiSL = await predictSLWithAI(rawDesc, partyName, amount, isDeposit)

    if (aiSL) {
      return aiSL
    }
  }

  // ---------------------------------------------------------
  // گام ۳: آخرین سنگر (Default)
  // ---------------------------------------------------------
  console.warn(`🤷‍♂️ No SL found via Hardcode, DB, or AI. Using Default.`)
  return isDeposit ? "211002" : "111901"
}

async function findSmartRuleFromDB(
  description: string,
  partyName: string
): Promise<{
  code: string
  title: string
  type: "DL" | "SL"
  matchedKeyword: string
} | null> {
  // نرمال‌سازی متن برای جستجو
  const textToSearch = `${description} ${partyName}`.toLowerCase().trim()

  // دریافت قوانینی که کیورد دارند
  // نکته: برای پرفورمنس بهتر، می‌توان این دیتا را کش کرد یا فقط رکوردهای مرتبط را سلکت کرد
  // اما فعلا برای سادگی کل رول‌ها را چک می‌کنیم (چون تعدادشان زیاد نیست)
  const { data: rules, error } = await supabaseService
    .from("rahkaran_accounts")
    .select("code, title, account_type, match_keywords")

  if (error || !rules) {
    console.error("Error fetching smart rules:", error)
    return null
  }

  // جستجوی دقیق
  for (const rule of rules) {
    if (!rule.match_keywords) continue

    for (const keyword of rule.match_keywords) {
      if (textToSearch.includes(keyword.toLowerCase())) {
        return {
          code: rule.code,
          title: rule.title,
          type: (rule.account_type as "DL" | "SL") || "DL",
          matchedKeyword: keyword
        }
      }
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
  mode: "deposit" | "withdrawal",
  hostDLCode?: string | null
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
  const isSmallAmount = amount < 3000000

  for (const special of SPECIAL_OVERRIDES) {
    if (special.keywords.some(k => normalizedDesc.includes(k))) {
      return {
        foundName: special.title,
        dlCode: special.dlCode || undefined,
        isFee: false,
        reason: `SPECIAL_SL:${special.slCode}`
      }
    }
  }

  const isStrictFee = STRICT_FEE_KEYWORDS.some(k => normalizedDesc.includes(k))
  if (isStrictFee && !normalizedDesc.includes("جبران رسوب")) {
    return {
      foundName: "هزینه بانکی",
      isFee: true,
      reason: "Strict Fee Keyword"
    }
  }

  const isPettyCashHolder = PETTY_CASH_HOLDERS.some(
    h => cleanName.includes(h) || normalizedDesc.includes(h)
  )
  if (isPettyCashHolder) {
    let targetName =
      PETTY_CASH_HOLDERS.find(
        h => cleanName.includes(h) || normalizedDesc.includes(h)
      ) || cleanName
    const personAcc = await findAccountCode(targetName)
    if (personAcc.dlCode) {
      return {
        dlCode: personAcc.dlCode,
        dlType: personAcc.dlType,
        foundName: personAcc.foundName,
        isFee: false,
        reason: "SPECIAL_SL:111003"
      }
    }
  }

  const hasTransferKeyword = TRANSFER_TRIGGERS.some(k =>
    normalizedDesc.includes(k)
  )
  if (hasTransferKeyword) {
    const aiBank = await extractCounterpartyBankWithAI(
      normalizedDesc,
      hostDLCode
    )
    if (aiBank)
      return {
        dlCode: aiBank.dlCode,
        foundName: aiBank.title,
        isFee: false,
        reason: "AI Extracted Bank"
      }

    const recoveredBank = recoverBankFromDescription(normalizedDesc, hostDLCode)
    if (recoveredBank)
      return {
        dlCode: recoveredBank.code,
        foundName: recoveredBank.title,
        isFee: false,
        reason: "Regex Detected Bank"
      }
  }

  const hasFeeKeywordLegacy = FEE_KEYWORDS.some(k => normalizedDesc.includes(k))
  if (hasFeeKeywordLegacy && isSmallAmount) {
    return {
      foundName: "هزینه بانکی",
      isFee: true,
      reason: "Legacy Fee Keyword"
    }
  }

  if (hasTransferKeyword) {
    // تکرار برای اطمینان (اگرچه بالا چک شد، اما در کد اصلی شما دو بار بود)
    const aiBank = await extractCounterpartyBankWithAI(
      normalizedDesc,
      hostDLCode
    )
    if (aiBank)
      return {
        dlCode: aiBank.dlCode,
        foundName: aiBank.title,
        isFee: false,
        reason: "AI Extracted Bank"
      }
    const recoveredBank = recoverBankFromDescription(normalizedDesc, hostDLCode)
    if (recoveredBank)
      return {
        dlCode: recoveredBank.code,
        foundName: recoveredBank.title,
        isFee: false,
        reason: "Regex Detected Bank"
      }
  }

  // --- استخراج نام شرکت/شخص از متن (بخش جدید و مهم) ---
  const personMatch = normalizedDesc.match(/توسط\s+([\u0600-\u06FF\s]+)/)
  let candidates: any[] = []
  if (personMatch && personMatch[1]) {
    const extractedName = personMatch[1].trim().split(" ").slice(0, 3).join(" ")
    if (extractedName.length > 3) {
      const acc = await findAccountCode(extractedName)
      if (acc.dlCode)
        candidates.push({
          Code: acc.dlCode,
          Title: acc.foundName,
          DLTypeRef: acc.dlType,
          source: "Extracted Person Name"
        })
    }
  }

  if (cleanName.length > 2) {
    const acc = await findAccountCode(cleanName)
    if (acc.dlCode)
      candidates.push({
        Code: acc.dlCode,
        Title: acc.foundName,
        DLTypeRef: acc.dlType,
        source: "Name Match"
      })
  }

  // AI Decision Logic (عیناً از کد شما)
  const uniqueCandidates = Array.from(
    new Map(candidates.map(item => [item.Code || item.dl_code, item])).values()
  )
  const prompt = `
  You are an expert Chief Accountant. Map this transaction to the correct DL Code.
  Transaction:
  - Type: ${mode}
  - Amount: ${amount} IRR
  - Input Name: "${partyName}"
  - Description: "${normalizedDesc}"
  Candidates: ${JSON.stringify(
    uniqueCandidates.map(c => ({
      code: c.Code || c.dl_code,
      name: c.Title || c.title,
      source: c.source
    })),
    null,
    2
  )}
  Rules:
  1. Self Transfer ("آذر یورد", "خودم", "جبران رسوب") -> If no bank candidate found, return UNKNOWN.
  2. Name Match -> Select Candidate.
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
    if (result.decision === "IS_FEE")
      return { foundName: "هزینه بانکی", isFee: true, reason: result.reason }
    if (result.decision === "SELECTED_CODE" && result.code) {
      const selectedCandidate = uniqueCandidates.find(
        c => (c.Code || c.dl_code) == result.code
      )
      return {
        dlCode: result.code,
        dlType: selectedCandidate?.DLTypeRef,
        foundName: result.name,
        isFee: false,
        reason: result.reason
      }
    }
  } catch (e) {}

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

    const { mode, items, bankDLCode, branchId } = payload
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

      // متغیرهای تصمیم‌گیری
      let finalDLCode: string | undefined = undefined
      let finalFoundName = "نامشخص"
      let finalIsFee = false
      let finalReason = ""
      let finalSL = isDeposit ? DEPOSIT_SL_CODE : WITHDRAWAL_SL_CODE
      let decisionMade = false

      // ---------------------------------------------------------
      // 💎 گام 0: بررسی تنخواه‌داران (اولویت مطلق برای امین امین‌نیا و ...)
      // ---------------------------------------------------------
      const cleanName = partyName.replace(/Unknown|نامشخص/gi, "").trim()
      const isPettyCashHolder = PETTY_CASH_HOLDERS.some(
        holder => cleanName.includes(holder) || rawDesc.includes(holder)
      )

      if (isPettyCashHolder) {
        console.log(
          `👤 Petty Cash Holder Detected in: ${partyName} / ${rawDesc}`
        )
        let targetName =
          PETTY_CASH_HOLDERS.find(
            h => cleanName.includes(h) || rawDesc.includes(h)
          ) || cleanName

        // جستجوی کد تفصیلی شخص (مثلاً امین امین‌نیا)
        const personAcc = await findAccountCode(targetName)

        if (personAcc.dlCode) {
          finalDLCode = personAcc.dlCode
          finalFoundName = personAcc.foundName
          finalSL = "111003" // 🔥 همیشه معین تنخواه برای این افراد
          finalReason = "SPECIAL_SL:111003 (Petty Cash Holder)"
          decisionMade = true
          console.log(
            `✅ Fixed Petty Cash: ${finalFoundName} (DL: ${finalDLCode}) -> SL: 111003`
          )
        }
      }

      // ---------------------------------------------------------
      // 🌟 گام 1: بررسی قوانین هوشمند (اگر در گام قبلی تصمیم‌گیری نشده)
      // ---------------------------------------------------------
      if (!decisionMade) {
        const smartMatch = await findSmartRule(rawDesc, partyName)
        if (smartMatch) {
          // اگر کد عمومی بانک یا تنخواه بود، فقط به عنوان سرنخ استفاده کن و متوقف نشو
          if (["111005", "111003"].includes(smartMatch.code)) {
            console.log(
              `⚠️ Generic Code Found (${smartMatch.code}). Continuing search for details...`
            )
            finalSL = smartMatch.code
            finalReason = `Hint: ${smartMatch.code}`
            // decisionMade = false میماند
          } else {
            // کد دقیق پیدا شد (مثل بیمه یا حقوق)
            console.log(
              `🔒 Smart Rule Applied: ${smartMatch.title} (${smartMatch.code})`
            )
            finalFoundName = smartMatch.title
            finalReason = `SMART_RULE:${smartMatch.code}`
            decisionMade = true

            if (
              smartMatch.type === "SL" ||
              ["211003", "211004", "211202", "621105"].includes(smartMatch.code)
            ) {
              finalSL = smartMatch.code
              finalDLCode = undefined
            } else {
              finalDLCode = smartMatch.code
            }
          }
        }
      }

      // ---------------------------------------------------------
      // گام 2: روش‌های قدیمی (اگر هنوز تصمیم‌گیری نشده)
      // ---------------------------------------------------------
      if (!decisionMade || !finalDLCode) {
        const decision = await smartAccountFinder(
          partyName,
          rawDesc,
          item.amount,
          mode as any,
          bankDLCode
        )

        if (decision.dlCode || decision.isFee) {
          finalDLCode = decision.dlCode
          finalFoundName = decision.foundName
          finalIsFee = decision.isFee || false
          finalReason = decision.reason || "Smart Finder"

          if (decision.reason?.startsWith("SPECIAL_SL:")) {
            finalSL = decision.reason.split(":")[1]
          }
        }
      }
      // اصلاحات نهایی
      if (
        finalDLCode === "FEE" ||
        finalDLCode === "BANK_FEE" ||
        finalDLCode === "IS_FEE" ||
        finalIsFee
      ) {
        finalDLCode = "111106" // اگر تفصیلی هزینه دارید اینجا بگذارید، وگرنه نال
        finalFoundName = "هزینه کارمزد بانکی"
        finalSL = "621105" // معین هزینه بانکی
        finalIsFee = true
      }
      if (!finalDLCode && finalFoundName === "نامشخص" && !finalIsFee) {
        if (
          rawDesc.includes("جبران") ||
          rawDesc.includes("انتقال") ||
          rawDesc.includes("ساتنا") ||
          rawDesc.includes("پایا") ||
          rawDesc.includes("واریز از")
        ) {
          const recovered = recoverBankFromDescription(rawDesc, bankDLCode)
          if (recovered) {
            console.log(
              `✅ FIXED: Bank Transfer Detected -> ${recovered.title}`
            )
            finalDLCode = recovered.code
            finalFoundName = recovered.title
            finalSL = "111005" // ✅ اینجا SL را فورس می‌کنیم روی موجودی بانک
          }
        }
      }

      // ۳. بررسی نهایی: اگر تفصیلی یک بانک است (شروع با 200)، معین باید 111005 باشد
      if (
        finalDLCode &&
        finalDLCode.startsWith("200") &&
        finalDLCode !== "200000"
      ) {
        console.log(
          `🏦 Bank Detected in DL (${finalDLCode}). Forcing SL to 111005`
        )
        finalSL = "111005"
      }
      // اگر کد تفصیلی همان کد معین تشخیص داده شده بود (اشتباه رایج)
      if (
        finalDLCode &&
        ["211003", "211004", "211202", "111003"].includes(finalDLCode)
      ) {
        console.log(
          `⚠️ Correcting Misplaced Code: Moving ${finalDLCode} from DL to SL`
        )
        finalSL = finalDLCode
        finalDLCode = undefined
      }

      // لاجیک نجات‌بخش (انتقال)
      if (!finalDLCode && !finalIsFee && finalFoundName === "نامشخص") {
        if (
          rawDesc.includes("جبران") ||
          rawDesc.includes("انتقال") ||
          rawDesc.includes("ساتنا")
        ) {
          const recovered = recoverBankFromDescription(rawDesc, bankDLCode)
          if (recovered) {
            finalDLCode = recovered.code
            finalFoundName = recovered.title
            finalSL = "111005" // حساب رابط
          }
        }
      }

      // ---------------------------------------------------------
      // ساخت کوئری
      // ---------------------------------------------------------
      debugDecisions.push({
        Name: partyName,
        Decision: finalDLCode || finalSL,
        Mapped: finalFoundName,
        Reason: finalReason
      })
      successfulTrackingCodes.push(item.tracking || "")

      const dlValue =
        finalDLCode && finalDLCode !== "111106" ? `N'${finalDLCode}'` : "NULL"

      sqlItemsBuffer += `
        -- Item: ${escapeSql(partyName)} -> ${finalFoundName}
        SET @Amount = ${item.amount};
        SET @Desc = N'${safeDesc}';
        
        SET @Str_PartySLCode = N'${finalSL}'; 
        SET @Str_PartyDLCode = ${dlValue}; 
        SET @Str_BankSLCode = N'${FIXED_BANK_SL}'; 
        SET @Str_BankDLCode = N'${FIXED_BANK_DL}';

        -- A. تنظیمات طرف حساب
        SET @Ref_SL = NULL; 
        SELECT TOP 1 @Ref_SL = SLID, @Ref_GL = GLRef FROM [FIN3].[SL] WHERE Code = @Str_PartySLCode;
        
        IF @Ref_SL IS NULL 
           SELECT TOP 1 @Ref_SL = SLID, @Ref_GL = GLRef FROM [FIN3].[SL] 
           WHERE Code = CASE WHEN ${isDeposit ? 1 : 0} = 1 THEN '${DEPOSIT_SL_CODE}' ELSE '${WITHDRAWAL_SL_CODE}' END;
           
        SELECT TOP 1 @Ref_AccountGroup = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @Ref_GL;

        SET @Ref_DL = NULL; SET @Ref_DLType = NULL; 
        SET @Var_DLLevel = 4; 
        SET @RealLevel = NULL;
        
        IF @Str_PartyDLCode IS NOT NULL
        BEGIN
             SELECT TOP 1 @Ref_DL = DLID, @Ref_DLType = DLTypeRef FROM [FIN3].[DL] WHERE Code = @Str_PartyDLCode;
             
             -- اگر تفصیلی پیدا نشد، مقدارش را NULL کن تا ارور FK ندهد
             IF @Ref_DL IS NULL SET @Str_PartyDLCode = NULL; 
             ELSE
             BEGIN
                 SELECT TOP 1 @RealLevel = [Level] FROM [FIN3].[DLTypeRelation] WHERE SLRef = @Ref_SL AND DLTypeRef = @Ref_DLType;
                 IF @RealLevel IS NOT NULL SET @Var_DLLevel = @RealLevel;
             END
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
             VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef, Debit, Credit, Description, RowNumber, IsCurrencyBased,
             DLLevel4, DLTypeRef4, DLLevel5, DLTypeRef5, DLLevel6, DLTypeRef6
        ) VALUES (
             @VoucherItemID, @VoucherID, @BranchRef, @Ref_SL, CAST(@Str_PartySLCode AS NVARCHAR(50)), @Ref_GL, @Ref_AccountGroup, ${isDeposit ? "0" : "@Amount"}, ${isDeposit ? "@Amount" : "0"}, @Desc, ${currentRowIndex}, 0,
             CASE WHEN @Var_DLLevel = 4 AND @Str_PartyDLCode IS NOT NULL THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 4 AND @Str_PartyDLCode IS NOT NULL THEN @Ref_DLType ELSE NULL END,
             CASE WHEN @Var_DLLevel = 5 AND @Str_PartyDLCode IS NOT NULL THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 5 AND @Str_PartyDLCode IS NOT NULL THEN @Ref_DLType ELSE NULL END,
             CASE WHEN @Var_DLLevel = 6 AND @Str_PartyDLCode IS NOT NULL THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 6 AND @Str_PartyDLCode IS NOT NULL THEN @Ref_DLType ELSE NULL END
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
    }

    if (validItemsCount > 0) {
      console.log(
        "📋 DECISION REPORT JSON:",
        JSON.stringify(debugDecisions, null, 2)
      )

      // ... اینجا کد finalSql و اجرای آن (که قبلا داشتید) ...
      // برای اطمینان کد کامل finalSql را از پیام قبلی کپی کنید
      const finalSql = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;
      -- ... (کپی دقیق بخش finalSql از کدهای قبلی) ...
      DECLARE @RetryCount INT = 0;
      DECLARE @ErrorMessage NVARCHAR(4000);
      DECLARE @RealLevel INT;
      DECLARE @VoucherID BIGINT;
      DECLARE @FiscalYearRef BIGINT;
      DECLARE @VoucherNumber BIGINT; 
      DECLARE @RefNumStr NVARCHAR(50);
      DECLARE @DailyNumber INT;
      DECLARE @Sequence BIGINT;
      DECLARE @VoucherLockID BIGINT;

      DECLARE @BranchRef BIGINT = ${branchId ? branchId : "NULL"};
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

           SELECT @DailyNumber = ISNULL(MAX(DailyNumber), 0) + 500 
           FROM [FIN3].[Voucher] WITH (UPDLOCK, SERIALIZABLE) 
           WHERE LedgerRef = @LedgerRef 
             AND BranchRef = @BranchRef 
             AND FiscalYearRef = @FiscalYearRef  
             AND Date = @Date;
           
           WHILE EXISTS (
               SELECT 1 FROM [FIN3].[Voucher] WITH (UPDLOCK, SERIALIZABLE)
               WHERE LedgerRef = @LedgerRef 
                 AND BranchRef = @BranchRef
                 AND FiscalYearRef = @FiscalYearRef 
                 AND Date = @Date 
                 AND DailyNumber = @DailyNumber
           )
           BEGIN
               SET @DailyNumber = @DailyNumber + 1;
           END

           EXEC [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;

           INSERT INTO [FIN3].[Voucher] (
                 VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
                 Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
                 Description, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields,
                 DailyNumber, Sequence
           ) VALUES (
                 @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, 
                 @VoucherNumber, @Date, @VoucherTypeRef, 
                 @UserRef, GETDATE(), @UserRef, GETDATE(), 0,
                 N'${safeHeaderDesc}', 0, 0, 0, 0,
                 @DailyNumber, @Sequence
           );

           EXEC [Sys3].[spGetNextId] 'FIN3.VoucherLock', @Id = @VoucherLockID OUTPUT;
           INSERT INTO [FIN3].[VoucherLock] (VoucherLockID, VoucherRef, UserRef, LastModificationDate) 
           VALUES (@VoucherLockID, @VoucherID, @UserRef, GETDATE());

           ${sqlItemsBuffer}

           UPDATE [FIN3].[Voucher] SET State = 1 WHERE VoucherID = @VoucherID;

           COMMIT TRANSACTION;
           SELECT 'Success' AS Status, 
                  @VoucherNumber AS VoucherNum,
                  @DailyNumber AS DailyNum, 
                  @RefNumStr AS RefNum;

      END TRY
      BEGIN CATCH
           IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
           SET @ErrorMessage = ERROR_MESSAGE();
           THROW 51000, @ErrorMessage, 1;
      END CATCH
      `

      const sqlRes = await executeSql(finalSql)
      if (sqlRes && sqlRes[0] && sqlRes[0].Status === "Success") {
        return {
          success: true,
          docId: sqlRes[0].VoucherNum.toString(),
          message: "OK",
          processedTrackingCodes: successfulTrackingCodes
        }
      } else {
        throw new Error(sqlRes?.[0]?.ErrMsg || "Unknown SQL Error")
      }
    }
    return { success: true, message: "No items", results: [] }
  } catch (error: any) {
    console.error("🔥 FATAL:", error)
    return { success: false, error: error.message }
  }
}
