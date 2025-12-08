import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"
import {
  verifyNameMatch,
  detectFee,
  verifyWithAI,
  auditVoucherWithAI
} from "./bankIntelligence"

export interface RahkaranSyncResult {
  success: boolean
  docId?: string
  error?: string
  message?: string
  party?: string // ✅ اضافه شد
  sl?: string // ✅ اضافه شد
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
  "خدمات بانکی"
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

interface SyncPayload {
  mode: "deposit" | "withdrawal"
  date: string
  description: string
  totalAmount: number
  branchId?: number
  workspaceId: string // ✅ اضافه شد: برای ثبت در کارتابل مدیر
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
        if (best.similarity < 0.5) continue
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

async function humanizeDescription(
  rawDesc: string,
  partyName: string,
  type: "deposit" | "withdrawal"
): Promise<string> {
  try {
    if (!rawDesc) return `بابت ${partyName}`
    const prompt = `
    You are a professional Iranian accountant. Rewrite the following transaction description into a formal Farsi accounting string.
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

function detectBankInfo(description: string): {
  slCode: string
  dlCode: string
  bankName: string
} {
  // پیش‌فرض: معین موجودی بانک (111005) - تفصیلی نامشخص (مثلاً کد اول لیست یا نال)
  const DEFAULT = { slCode: "111005", dlCode: "200001", bankName: "بانک" }

  if (!description) return DEFAULT

  const normalizedDesc = description.replace(/\s/g, "")

  // نگاشت شماره حساب‌ها به کدهای تفصیلی (DL) طبق عکس ارسالی شما
  // ⚠️ نکته: لطفاً کدهای سمت راست (dlCode) را با سیستم خود چک کنید اگر مغایرت داشت تغییر دهید
  const BANK_MAPPINGS: Record<string, { dl: string; name: string }> = {
    // بانک ملی (طبق عکس: 200001 و 200026 و ...)
    "0104813180001": { dl: "200001", name: "بانک ملی مرکزی" },
    "۰۱۰۴۸۱۳۱۸۰۰۰۱": { dl: "200001", name: "بانک ملی مرکزی" },

    // اقتصاد نوین (طبق عکس: 200002)
    "1021261161111": { dl: "200002", name: "بانک اقتصاد نوین" },

    // پاسارگاد (طبق عکس: 200004)
    IR750570032080013698864101: { dl: "200004", name: "بانک پاسارگاد" },
    "100425641": { dl: "200004", name: "بانک پاسارگاد" }, // بخشی از شبا برای اطمینان

    // تجارت (طبق عکس: 200005)
    "546093999": { dl: "200005", name: "بانک تجارت" },
    "57018000000000502063499": { dl: "200005", name: "بانک تجارت" },

    // سپه (طبق عکس: 200006)
    "16692": { dl: "200006", name: "بانک سپه" },
    IR030150000186643114095731: { dl: "200006", name: "بانک سپه" },

    // ملت (طبق عکس: 200034 یا 200040)
    "9880346828": { dl: "200034", name: "بانک ملت شعبه بهشتی" },
    "139012000000009570662601": { dl: "200034", name: "بانک ملت" },

    // کارآفرین (طبق عکس: 200035)
    "0101684239601": { dl: "200035", name: "بانک کارآفرین" }
  }

  for (const [accNum, info] of Object.entries(BANK_MAPPINGS)) {
    if (normalizedDesc.includes(accNum)) {
      return { slCode: "111005", dlCode: info.dl, bankName: info.name }
    }
  }

  return DEFAULT
}

export async function syncToRahkaranSystem(payload: SyncPayload): Promise<any> {
  try {
    console.log("\n---------------------------------------------------")
    console.log("🚀 STARTING PIPELINE (ISOLATED VOUCHER TYPE)")
    console.log("---------------------------------------------------")

    const { mode, items, workspaceId } = payload
    const isDeposit = mode === "deposit"
    const resultsTable = []

    // ************************************************************
    // 👇👇👇 تنظیمات را اینجا انجام دهید 👇👇👇
    // ************************************************************
    const FIXED_BRANCH_ID = 30

    // ⚠️ آی‌دی نوع سند جدید (سند ربات) را اینجا بنویسید
    // اگر از لیست فعلی استفاده کنید، تداخل پیش می‌آید. حتما یک نوع جدید بسازید.
    const FIXED_VOUCHER_TYPE = 30 // <--- مثلاً 30

    const FIXED_LEDGER_ID = 1
    const FIXED_BANK_SL = "111005" // معین بانک
    const DEPOSIT_SL_CODE = "211002" // معین واریز
    const WITHDRAWAL_SL_CODE = "111901" // معین برداشت
    // ************************************************************

    const safeDate = payload.date
    const dateMatch = payload.description?.match(/\d{4}\/\d{2}\/\d{2}/)
    const jalaliDate = dateMatch ? dateMatch[0] : safeDate
    const headerDescription = await generateHumanHeader(jalaliDate)
    const safeHeaderDesc = escapeSql(headerDescription)

    let sqlItemsBuffer = ""
    let validItemsCount = 0
    let currentRowIndex = 1

    for (const item of items) {
      const partyName = item.partyName || "نامشخص"
      const rawDesc = item.desc || ""
      const bankInfo = detectBankInfo(rawDesc)
      const humanDesc = await humanizeDescription(
        rawDesc,
        partyName,
        mode as "deposit" | "withdrawal"
      )
      const safeDesc = escapeSql(humanDesc)

      const decision = { dlCode: null as string | null, isFee: false }
      const feeCheck = detectFee(partyName, rawDesc, item.amount)

      if (feeCheck.isFee) {
        decision.isFee = true
      } else {
        const searchResult = await findAccountCode(partyName)
        decision.dlCode = searchResult.dlCode || null
      }

      if (decision.isFee || decision.dlCode !== null) {
        const slCode = isDeposit ? DEPOSIT_SL_CODE : WITHDRAWAL_SL_CODE
        const finalSL = decision.isFee ? "921145" : slCode
        const dlValue = decision.dlCode ? `N'${decision.dlCode}'` : "NULL"

        sqlItemsBuffer += `
        -- ITEM ROW: ${currentRowIndex} (${escapeSql(partyName)})
        SET @Amount = ${item.amount};
        SET @Desc = N'${safeDesc}';
        
        SET @Str_PartySLCode = N'${finalSL}'; 
        SET @Str_PartyDLCode = ${dlValue}; 
        SET @Str_BankSLCode = N'${FIXED_BANK_SL}'; 
        SET @Str_BankDLCode = N'${bankInfo.dlCode}';

        -- A. طرف حساب
        SET @Ref_SL = NULL; 
        SELECT TOP 1 @Ref_SL = SLID, @Ref_GL = GLRef FROM [FIN3].[SL] WHERE Code = @Str_PartySLCode;
        IF @Ref_SL IS NULL 
           SELECT TOP 1 @Ref_SL = SLID, @Ref_GL = GLRef FROM [FIN3].[SL] 
           WHERE Code = CASE WHEN ${isDeposit ? 1 : 0} = 1 THEN '${DEPOSIT_SL_CODE}' ELSE '${WITHDRAWAL_SL_CODE}' END;
           
        SELECT TOP 1 @Ref_AccountGroup = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @Ref_GL;

        SET @Ref_DL = NULL; SET @Ref_DLType = NULL; SET @Var_DLLevel = NULL;
        IF @Str_PartyDLCode IS NOT NULL
        BEGIN
             SELECT TOP 1 @Ref_DL = DLID, @Ref_DLType = DLTypeRef FROM [FIN3].[DL] WHERE Code = @Str_PartyDLCode;
             SELECT TOP 1 @Var_DLLevel = [Level] FROM [FIN3].[DLTypeRelation] WHERE SLRef = @Ref_SL AND DLTypeRef = @Ref_DLType;
        END

        -- B. بانک
        SET @Ref_BankSL = NULL; 
        SELECT TOP 1 @Ref_BankSL = SLID, @Ref_BankGL = GLRef FROM [FIN3].[SL] WHERE Code = @Str_BankSLCode;
        SELECT TOP 1 @Ref_BankAccountGroup = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @Ref_BankGL;
        
        SET @Ref_BankDL = NULL; SET @Ref_BankDLType = NULL;
        SELECT TOP 1 @Ref_BankDL = DLID, @Ref_BankDLType = DLTypeRef FROM [FIN3].[DL] WHERE Code = @Str_BankDLCode;

        -- C. اینزرت آیتم طرف حساب
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @VoucherItemID OUTPUT;
        INSERT INTO [FIN3].[VoucherItem] (
             VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef, Debit, Credit, Description, RowNumber, IsCurrencyBased,
             DLLevel4, DLTypeRef4, DLLevel5, DLTypeRef5, DLLevel6, DLTypeRef6
        ) VALUES (
             @VoucherItemID, @VoucherID, @BranchRef, @Ref_SL, CAST(@Str_PartySLCode AS NVARCHAR(50)), @Ref_GL, @Ref_AccountGroup, ${isDeposit ? "0" : "@Amount"}, ${isDeposit ? "@Amount" : "0"}, @Desc, ${currentRowIndex}, 0,
             CASE WHEN @Var_DLLevel = 4 THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 4 THEN @Ref_DLType ELSE NULL END,
             CASE WHEN @Var_DLLevel = 5 THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 5 THEN @Ref_DLType ELSE NULL END,
             CASE WHEN @Var_DLLevel = 6 THEN CAST(@Str_PartyDLCode AS NVARCHAR(50)) ELSE NULL END, CASE WHEN @Var_DLLevel = 6 THEN @Ref_DLType ELSE NULL END
        );

        -- D. اینزرت آیتم بانک
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
      } else {
        resultsTable.push({ Name: partyName, Result: "Skipped 🟡" })
      }
    }

    if (validItemsCount > 0) {
      console.log(`🟢 Executing SQL for ${validItemsCount} items...`)

      const finalSql = `
      SET NOCOUNT ON;
      SET XACT_ABORT ON;

      DECLARE @RetryCount INT = 0;
      DECLARE @Success BIT = 0;
      DECLARE @ErrorMessage NVARCHAR(4000);
      
      -- تعریف متغیرهای مورد نیاز
      DECLARE @VoucherID BIGINT;
      DECLARE @FiscalYearRef BIGINT;
      DECLARE @VoucherNumber BIGINT; 
      DECLARE @RefNumStr NVARCHAR(50);
      DECLARE @DailyNumber INT;
      DECLARE @Sequence BIGINT;
      DECLARE @RetVal INT;

      -- پارامترهای ورودی
      DECLARE @BranchRef BIGINT; 
      DECLARE @LedgerRef BIGINT = ${FIXED_LEDGER_ID};
      DECLARE @VoucherTypeRef BIGINT = 30; -- نوع سند راینو
      DECLARE @UserRef INT = 1; 
      DECLARE @Date NVARCHAR(20) = N'${safeDate}';
      
      -- متغیرهای آفست برای جلوگیری از تداخل با کاربر
      -- این عدد باعث می‌شود عطف ربات از 9 میلیون شروع شود و با کاربر (1, 2, 3) قاطی نشود
      DECLARE @Offset BIGINT = 9000000; 

      -- متغیرهای آیتم‌ها
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

            -- 1. یافتن شعبه (رفع خطای Foreign Key)
            SELECT TOP 1 @BranchRef = BranchID FROM [GNR3].[Branch];
            IF @BranchRef IS NULL THROW 51000, 'Error: No Branch found.', 1;

            -- 2. یافتن سال مالی
            SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] 
            WHERE LedgerRef = @LedgerRef AND StartDate <= @Date AND EndDate >= @Date;
            IF @FiscalYearRef IS NULL 
               SELECT TOP 1 @FiscalYearRef = FiscalYearRef FROM [GNR3].[LedgerFiscalYear] WHERE LedgerRef = @LedgerRef ORDER BY EndDate DESC;

            -- 3. محاسبه شماره سند (Number) -> این برای نوع سند 30 از 1 شروع می‌شود
            SELECT @VoucherNumber = ISNULL(MAX(Number), 0) + 1
            FROM [FIN3].[Voucher] WITH (UPDLOCK, HOLDLOCK) 
            WHERE FiscalYearRef = @FiscalYearRef 
              AND LedgerRef = @LedgerRef 
              AND VoucherTypeRef = @VoucherTypeRef;

            IF @VoucherNumber IS NULL SET @VoucherNumber = 1;

            -- 4. محاسبه شماره عطف و Sequence (با آفست 9 میلیونی)
            -- این بخش حیاتی است: عطف می‌شود 9000001 و با عطف کاربر (1) تداخل نمی‌کند
            SET @Sequence = @Offset + @VoucherNumber;
            SET @RefNumStr = CAST(@Sequence AS NVARCHAR(50));

            -- چک کردن نهایی برای اطمینان از یکتایی (محض احتیاط)
            WHILE EXISTS (
                SELECT 1 FROM [FIN3].[Voucher] 
                WHERE FiscalYearRef = @FiscalYearRef 
                  AND LedgerRef = @LedgerRef
                  AND (ReferenceNumber = @RefNumStr OR Sequence = @Sequence)
            )
            BEGIN
                SET @VoucherNumber = @VoucherNumber + 1;
                SET @Sequence = @Offset + @VoucherNumber;
                SET @RefNumStr = CAST(@Sequence AS NVARCHAR(50));
            END

            -- محاسبه شماره روزانه
            SELECT @DailyNumber = ISNULL(MAX(DailyNumber), 0) + 1 
            FROM [FIN3].[Voucher] 
            WHERE LedgerRef = @LedgerRef AND Date = @Date;

            -- دریافت ID
            EXEC @RetVal = [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;

            -- اینزرت هدر سند
            INSERT INTO [FIN3].[Voucher] (
                 VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
                 Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
                 Description, Description_En, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields,
                 DailyNumber, Sequence, ReferenceNumber, IsReadonly, AuxiliaryNumber
            ) VALUES (
                 @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, 
                 @VoucherNumber, @Date, @VoucherTypeRef, 
                 @UserRef, GETDATE(), @UserRef, GETDATE(), 0,
                 N'${safeHeaderDesc}', N'', 0, 0, 0, 0, 
                 @DailyNumber, @Sequence, @RefNumStr, 0, N''
            );

            -- افزودن آیتم‌ها
            ${sqlItemsBuffer}

            -- ثبت نهایی
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
        console.log(`🎉 SUCCESS! Voucher Created: #${sqlRes[0].VoucherNum}`)
        resultsTable.forEach(row => {
          if (row.Result === "Batched 🟢")
            row.Result = `Saved #${sqlRes[0].VoucherNum} 🟢`
        })
        return {
          success: true,
          docId: sqlRes[0].VoucherNum.toString(),
          results: resultsTable
        }
      }
    }
    return { success: true, message: "No Items", results: resultsTable }
  } catch (error: any) {
    console.error(error)
    return { success: false, error: error.message }
  }
}
