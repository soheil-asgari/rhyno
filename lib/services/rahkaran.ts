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
  "دفتر"
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

async function findAccountCode(
  partyName: string
): Promise<{
  dlCode?: string
  dlType?: number
  slId?: number
  foundName: string
}> {
  let cleanName = partyName.replace(/نامشخص/g, "").trim()
  if (!cleanName || cleanName.length < 2) return { foundName: "نامشخص" }

  const stopWords = [
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
    "نامشخص"
  ]

  let processedName = cleanName
  stopWords.forEach(word => {
    processedName = processedName.replace(new RegExp(word, "g"), "").trim()
  })

  // ---------------------------------------------------------
  // 1. جستجوی وکتور
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
        // --- اصلاح شد: ابتدا بررسی الگوریتمی ---
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

        // اگر الگوریتم رد کرد، حالا از هوش مصنوعی بپرس (هزینه دارد)
        if (best.similarity < 0.5) continue // برای AI سخت‌گیرتر باشیم

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
  // 2. جستجوی SQL
  // ---------------------------------------------------------
  console.log("⚠️ Using SQL Fallback for:", cleanName)

  const words = processedName
    .split(/\s+/)
    .filter(w => w.length > 1 && !GENERIC_WORDS.has(w))
  const w1 = words[0] || cleanName.split(" ")[0]
  const w2 = words[1] || ""

  const sqlSearch = `
    SET NOCOUNT ON;
    DECLARE @RawName nvarchar(500) = N'${escapeSql(cleanName)}';
    DECLARE @W1 nvarchar(100) = N'${escapeSql(w1)}';
    DECLARE @W2 nvarchar(100) = N'${escapeSql(w2)}';
    SET @RawName = REPLACE(REPLACE(@RawName, N'ي', N'ی'), N'ك', N'ک');
    SET @W1 = REPLACE(REPLACE(@W1, N'ي', N'ی'), N'ك', N'ک');
    SET @W2 = REPLACE(REPLACE(@W2, N'ي', N'ی'), N'ك', N'ک');
    DECLARE @LikeName nvarchar(500) = REPLACE(@RawName, N' ', N'%');

    SELECT TOP 3 Code, DLTypeRef, Title, Score
    FROM (
        SELECT TOP 10 Code, DLTypeRef, Title,
            (
                (CASE WHEN CleanTitle = @RawName THEN 1000 ELSE 0 END) +
                (CASE WHEN CleanTitle LIKE N'%'+ @LikeName +'%' THEN 500 ELSE 0 END) +
                (CASE WHEN @W1 <> '' AND @W2 <> '' AND CleanTitle LIKE N'%'+ @W1 +'%' AND CleanTitle LIKE N'%'+ @W2 +'%' THEN 200 ELSE 0 END) +
                (CASE WHEN @W1 <> '' AND CleanTitle LIKE N'%'+ @W1 +'%' THEN 50 ELSE 0 END)
            ) as Score
        FROM (
            SELECT Code, DLTypeRef, Title, 
                REPLACE(REPLACE(Title, N'ي', N'ی'), N'ك', N'ک') as CleanTitle
            FROM [FIN3].[DL]
            WHERE (@W1 <> '' AND REPLACE(Title, N'ي', N'ی') LIKE N'%'+ @W1 +'%')
        ) as T 
    ) as BestMatch
    WHERE Score >= 50
    ORDER BY Score DESC;
  `

  const res = await executeSql(sqlSearch)

  if (res && res.length > 0) {
    for (const row of res) {
      // --- اصلاح شد: ابتدا بررسی الگوریتمی ---
      if (verifyNameMatch(cleanName, row.Title)) {
        console.log(`✅ Algo Verified SQL: "${cleanName}" => "${row.Title}"`)
        return { dlCode: row.Code, dlType: row.DLTypeRef, foundName: row.Title }
      }

      // اگر الگوریتم رد کرد، از هوش مصنوعی بپرس
      const isVerified = await verifyWithAI(cleanName, row.Title)
      if (isVerified) {
        console.log(`✅ AI Verified SQL: "${cleanName}" => "${row.Title}"`)
        return { dlCode: row.Code, dlType: row.DLTypeRef, foundName: row.Title }
      }
    }
  }

  // جستجوی معین
  const slSql = `
     SELECT TOP 1 SLID, Title FROM [FIN3].[SL] 
     WHERE Title LIKE N'%${escapeSql(w1)}%' 
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

export async function syncToRahkaranSystem(payload: any): Promise<any> {
  try {
    console.log("\n---------------------------------------------------")
    console.log("🚀 STARTING ROBUST SIMULATION (FAIL-SAFE MODE)")
    console.log("---------------------------------------------------")

    const { mode, items } = payload
    const isDeposit = mode === "deposit"
    const resultsTable = []

    const normalizeText = (text: string) =>
      text ? text.replace(/[يیكک]/g, m => (m === "ك" ? "ک" : "ی")) : ""

    // 1️⃣ تعیین حساب پیش‌فرض امن بر اساس نوع سند (همان اول کار!)
    const DEFAULT_SAFE_SL = isDeposit
      ? "21901 (پیش دریافت - موقت)"
      : "11901 (پیش پرداخت - موقت)"

    for (const item of items) {
      const partyName = item.partyName || "نامشخص"
      const rawDesc = item.desc || ""

      console.log(
        `📦 Item: [${partyName}] | Amount: ${item.amount.toLocaleString()}`
      )

      // تشخیص کارمزد
      const feeCheck = detectFee(partyName, rawDesc, item.amount)

      // آبجکت تصمیم‌گیری (با مقدار پیش‌فرض پر می‌شود)
      const decision = {
        sl: DEFAULT_SAFE_SL, // <--- نکته کلیدی: هرگز UNKNOWN یا undefined نیست
        dlCode: null as string | null,
        reason: "Default Strategy",
        isFee: feeCheck.isFee
      }

      if (decision.isFee) {
        decision.sl = "921145 (هزینه بانکی)"
        decision.reason = feeCheck.reason
        console.log(`   💰 Fee Logic: YES (${decision.reason})`)
      } else {
        // جستجوی حساب
        const searchResult = await findAccountCode(partyName)
        decision.dlCode = searchResult.dlCode || null

        if (searchResult.dlCode) {
          // بررسی سابقه
          const historySql = `
              SELECT TOP 1 SL.Title + N' (' + SL.Code + N')' as SLInfo
              FROM [FIN3].[VoucherItem] VI
              JOIN [FIN3].[SL] SL ON VI.SLRef = SL.SLID
              WHERE (VI.DLLevel4 = N'${searchResult.dlCode}' OR VI.DLLevel5 = N'${searchResult.dlCode}' OR VI.DLLevel6 = N'${searchResult.dlCode}')
              AND ${isDeposit ? "ISNULL(VI.Credit, 0) > 0" : "ISNULL(VI.Debit, 0) > 0"}
              ORDER BY VI.VoucherItemID DESC
          `
          const histRes = await executeSql(historySql)

          // 🔥 بررسی دقیق اینکه آیا SLInfo واقعاً مقدار دارد؟
          if (histRes && histRes[0] && histRes[0].SLInfo) {
            decision.sl = histRes[0].SLInfo
            decision.reason = "Found in History"
            console.log(`   🗄️ History Logic: Found (${decision.sl})`)
          } else {
            console.log(
              `   ⚠️ History Logic: DL Found but NO History. Checking Relations...`
            )

            // بررسی ارتباط
            let relationFound = false
            if (searchResult.dlType) {
              const relSql = `
                    SELECT TOP 1 SL.Title + N' (' + SL.Code + N')' as SLInfo 
                    FROM [FIN3].[DLTypeRelation] R 
                    JOIN [FIN3].[SL] SL ON R.SLRef = SL.SLID 
                    WHERE DLTypeRef = ${searchResult.dlType}
                `
              const relRes = await executeSql(relSql)
              // 🔥 بررسی دقیق Null بودن
              if (relRes && relRes[0] && relRes[0].SLInfo) {
                decision.sl = relRes[0].SLInfo
                decision.reason = "From DL Type Relation"
                relationFound = true
                console.log(`   🔗 Relation Logic: Found (${decision.sl})`)
              }
            }

            if (!relationFound) {
              // اینجا نیازی نیست کاری کنیم چون decision.sl از اول روی DEFAULT_SAFE_SL تنظیم شده است
              decision.reason = "DL Found > No History/Rel > Kept Default"
              console.log(`   🛡️ Fallback Logic: Kept Default (${decision.sl})`)
            }
          }
        } else if (searchResult.slId) {
          decision.sl = `${searchResult.foundName} (${searchResult.slId})`
          decision.reason = "Direct SL Match"
        }
      }

      // 🛠️ سوپاپ اطمینان نهایی (محض احتیاط)
      if (!decision.sl || decision.sl === "undefined") {
        decision.sl = DEFAULT_SAFE_SL
        decision.reason += " | Forced Safety"
      }
      const safeSL = decision.sl
        ? decision.sl
            .toString()
            .trim()
            .replace(/[\r\n\t]/g, " ")
        : "UNKNOWN_ACCOUNT"
      // 4️⃣ بازرسی نهایی توسط Auditor AI
      const auditResult = await auditVoucherWithAI({
        inputName: partyName,
        inputDesc: rawDesc,
        amount: item.amount,
        selectedAccount: safeSL,
        isFee: decision.isFee
      })

      let auditorStatus = "✅ APPROVED"
      let finalAction = "READY TO SAVE"

      if (!auditResult.approved) {
        auditorStatus = "❌ REJECTED"
        console.error(`   🚨 AUDITOR ALERT: ${auditResult.reason}`)

        decision.sl = isDeposit
          ? "21901 (پیش دریافت - بازرسی شده)"
          : "11901 (پیش پرداخت - بازرسی شده)"
        decision.dlCode = null
        decision.reason = `Auditor Overrule: ${auditResult.reason}`
        finalAction = "REDIRECTED TO DEFAULT"
      }

      resultsTable.push({
        "Input Name": partyName,
        "Is Fee?": decision.isFee ? "YES" : "NO",
        "System Choice": decision.sl,
        "👮 Auditor": auditorStatus,
        "Final Action": finalAction,
        Reason: decision.reason
      })
    }

    console.table(resultsTable)
    return {
      success: true,
      docId: "SIMULATED_AUDIT",
      message: "Simulation completed."
    }
  } catch (error: any) {
    console.error(`❌ [SYSTEM ERROR]: ${error.message}`)
    return { success: false, error: error.message }
  }
}
