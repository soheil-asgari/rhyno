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
  let cleanName = partyName.replace(/نامشخص/g, "").trim()
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

export async function syncToRahkaranSystem(payload: SyncPayload): Promise<any> {
  try {
    console.log("\n---------------------------------------------------")
    console.log("🚀 STARTING PIPELINE (FINAL CONFIG: BRANCH 1 / LEDGER 1)")
    console.log("---------------------------------------------------")

    let lastGeneratedDocId = undefined
    const { mode, items, workspaceId } = payload
    const isDeposit = mode === "deposit"
    const resultsTable = []

    // ✅ تنظیم کدهای قطعی بر اساس دیتای شما
    const FIXED_BRANCH_ID = 1 // دفتر مراغه
    const FIXED_VOUCHER_TYPE = 1 // سند عمومی
    const FIXED_LEDGER_ID = 1 // دفتر کل پیش‌فرض

    const DEPOSIT_SL_CODE = "211002"
    const WITHDRAWAL_SL_CODE = "111901"

    const SAFE_DEFAULT = isDeposit
      ? `${DEPOSIT_SL_CODE} (بستانکاران)`
      : `${WITHDRAWAL_SL_CODE} (پیش پرداخت)`

    for (const item of items) {
      const partyName = item.partyName || "نامشخص"
      const rawDesc = item.desc || ""

      console.log(
        `📦 Processing: [${partyName}] | Amount: ${item.amount.toLocaleString()}`
      )

      // --- مرحله 1: جستجو ---
      const decision = {
        sl: SAFE_DEFAULT,
        dlCode: null as string | null,
        reason: "Init Default",
        isFee: false
      }

      const feeCheck = detectFee(partyName, rawDesc, item.amount)
      if (feeCheck.isFee) {
        decision.isFee = true
        decision.sl = "921145 (هزینه بانکی)"
        decision.reason = feeCheck.reason
      } else {
        const searchResult = await findAccountCode(partyName)
        decision.dlCode = searchResult.dlCode || null
        if (searchResult.dlCode && searchResult.foundName)
          decision.reason = "Found DL Match"
      }

      // --- مرحله 2: تصمیم‌گیری ---
      const foundDL = decision.dlCode !== null
      const isFee = decision.isFee
      const isIdentified = isFee || foundDL

      let auditorStatus = "PENDING"

      if (isIdentified) {
        auditorStatus = "✅ APPROVED"
        console.log(
          `✨ Auto-Approved: ${partyName} -> ${decision.dlCode || "Fee"}`
        )
      } else {
        auditorStatus = "❓ UNKNOWN"
      }

      // --- مرحله 3: اجرا ---
      const readyForRahkaran = isIdentified && auditorStatus === "✅ APPROVED"

      if (readyForRahkaran) {
        console.log(`🟢 Inserting to Rahkaran: ${partyName}`)

        const slMatch = decision.sl
          ? decision.sl.toString().match(/\((\d+)\)/)
          : null
        let slCodeToSave = slMatch
          ? slMatch[1]
          : isDeposit
            ? DEPOSIT_SL_CODE
            : WITHDRAWAL_SL_CODE

        const safeDesc = escapeSql(rawDesc)
        const safeDate = payload.date
        const dlCodeValue = decision.dlCode ? `N'${decision.dlCode}'` : "NULL"

        // SQL Transaction (Corrected IDs)
        const insertNativeSql = `
BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @ReturnVal INT;
    DECLARE @VoucherID BIGINT;
    DECLARE @VoucherItemID1 BIGINT;
    DECLARE @VoucherItemID2 BIGINT;
    DECLARE @VoucherLockID BIGINT;

    DECLARE @Date           NVARCHAR(20)  = N'${safeDate}';
    DECLARE @Amount         DECIMAL(18,0) = ${item.amount};
    DECLARE @Desc           NVARCHAR(MAX) = N'${safeDesc}';
    DECLARE @PartySLCode    NVARCHAR(50)  = N'${slCodeToSave}'; 
    DECLARE @PartyDLCode    NVARCHAR(50)  = ${dlCodeValue};

    DECLARE @BankSLCode     NVARCHAR(50)  = N'111005'; 
    
    DECLARE @SLRef BIGINT, @GLRef BIGINT, @AccountGroupRef BIGINT;
    DECLARE @BankSLRef BIGINT, @BankGLRef BIGINT, @BankAccountGroupRef BIGINT;
    
    DECLARE @DLRef BIGINT, @DLTypeRef BIGINT, @DLLevel INT;
    DECLARE @FiscalYearRef BIGINT, @VoucherNumber BIGINT;

    DECLARE @BranchRef BIGINT = ${FIXED_BRANCH_ID};
    DECLARE @LedgerRef BIGINT = ${FIXED_LEDGER_ID};
    DECLARE @VoucherTypeRef BIGINT = ${FIXED_VOUCHER_TYPE};
    DECLARE @UserRef INT = 1;

    -- ... (بخش‌های 1 تا 7 بدون تغییر باقی می‌مانند) ...
    -- (برای خلاصه شدن اینجا تکرار نکردم، همان کدهای قبلی را تا سر بخش 8 نگه دارید)
    -- ...

    ------------------------------------------------------------------
    -- 1. پیدا کردن SL طرف حساب (بستانکاران / پیش‌پرداخت)
    ------------------------------------------------------------------
    SELECT TOP 1 
        @SLRef = SL.SLID,
        @GLRef = SL.GLRef,
        @AccountGroupRef = GL.AccountGroupRef
    FROM [FIN3].[SL] SL
    LEFT JOIN [FIN3].[GL] GL ON SL.GLRef = GL.GLID
    WHERE SL.Code = @PartySLCode;

    IF @SLRef IS NULL
    BEGIN
        DECLARE @FallbackCode NVARCHAR(50) = CASE WHEN ${isDeposit ? 1 : 0} = 1 THEN '${DEPOSIT_SL_CODE}' ELSE '${WITHDRAWAL_SL_CODE}' END;
        
        SELECT TOP 1 
            @SLRef = SL.SLID,
            @GLRef = SL.GLRef,
            @AccountGroupRef = GL.AccountGroupRef
        FROM [FIN3].[SL] SL
        LEFT JOIN [FIN3].[GL] GL ON SL.GLRef = GL.GLID
        WHERE SL.Code = @FallbackCode;
    END

    IF @SLRef IS NULL THROW 51000, 'SL طرف حساب پیدا نشد', 1;

    ------------------------------------------------------------------
    -- 2. پیدا کردن SL بانک (موجودی نقد و بانک)
    ------------------------------------------------------------------
    SELECT TOP 1 
        @BankSLRef = SL.SLID,
        @BankGLRef = SL.GLRef,
        @BankAccountGroupRef = GL.AccountGroupRef
    FROM [FIN3].[SL] SL
    LEFT JOIN [FIN3].[GL] GL ON SL.GLRef = GL.GLID
    WHERE SL.Code = @BankSLCode;

    IF @BankSLRef IS NULL
    BEGIN
        DECLARE @ErrMsg NVARCHAR(250) = N'SL بانک پیدا نشد (کد: ' + ISNULL(@BankSLCode, N'نامشخص') + N')';
        THROW 51000, @ErrMsg, 1;
    END

    ------------------------------------------------------------------
    -- 3. DL Lookup
    ------------------------------------------------------------------
    IF @PartyDLCode IS NOT NULL AND @PartyDLCode <> 'NULL'
    BEGIN
        SELECT TOP 1 @DLRef = DLID, @DLTypeRef = DLTypeRef 
        FROM [FIN3].[DL] WHERE Code = @PartyDLCode;

        SELECT TOP 1 @DLLevel = [Level] 
        FROM [FIN3].[DLTypeRelation] 
        WHERE SLRef = @SLRef AND DLTypeRef = @DLTypeRef;
    END

    ------------------------------------------------------------------
    -- 4, 5, 6, 7 (سال مالی، شماره سند، هدر و قفل - بدون تغییر)
    ------------------------------------------------------------------
    SELECT TOP 1 @FiscalYearRef = FiscalYearRef
    FROM [GNR3].[LedgerFiscalYear] 
    WHERE LedgerRef = @LedgerRef AND StartDate <= @Date AND EndDate >= @Date;

    IF @FiscalYearRef IS NULL
        SELECT TOP 1 @FiscalYearRef = FiscalYearRef
        FROM [GNR3].[LedgerFiscalYear] 
        WHERE LedgerRef = @LedgerRef
        ORDER BY EndDate DESC;

    IF @FiscalYearRef IS NULL THROW 51002, 'سال مالی پیدا نشد', 1;

    SELECT @VoucherNumber = ISNULL(MAX(Number), 0) + 1 
    FROM [FIN3].[Voucher] 
    WHERE FiscalYearRef = @FiscalYearRef AND LedgerRef = @LedgerRef;

    EXEC @ReturnVal = [Sys3].[spGetNextId] 'FIN3.Voucher', @Id = @VoucherID OUTPUT;
    
    INSERT INTO [FIN3].[Voucher] (
        VoucherID, LedgerRef, FiscalYearRef, BranchRef, Number, Date, VoucherTypeRef,
        Creator, CreationDate, LastModifier, LastModificationDate, IsExternal,
        Description, State, IsTemporary, IsCurrencyBased, ShowCurrencyFields,
        DailyNumber, Sequence
    ) VALUES (
        @VoucherID, @LedgerRef, @FiscalYearRef, @BranchRef, @VoucherNumber,
        @Date, @VoucherTypeRef, @UserRef, GETDATE(),
        @UserRef, GETDATE(), 0,
        @Desc, 0, 0, 0, 0,
        @VoucherNumber, @VoucherNumber
    );

    EXEC @ReturnVal = [Sys3].[spGetNextId] 'FIN3.VoucherLock', @Id = @VoucherLockID OUTPUT;
    INSERT INTO [FIN3].[VoucherLock] (VoucherLockID, VoucherRef, UserRef, LastModificationDate)
    VALUES (@VoucherLockID, @VoucherID, @UserRef, GETDATE());


    ------------------------------------------------------------------
    -- ✅ اصلاحات اصلی اینجاست:
    ------------------------------------------------------------------

    -- 8. ردیف اول: طرف حساب (مشتری / تأمین‌کننده)
    EXEC @ReturnVal = [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @VoucherItemID1 OUTPUT;

    INSERT INTO [FIN3].[VoucherItem] (
        VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
        Debit, Credit, Description, RowNumber, IsCurrencyBased,
        DLLevel4, DLTypeRef4, DLLevel5, DLTypeRef5, DLLevel6, DLTypeRef6
    ) VALUES (
        @VoucherItemID1, @VoucherID, @BranchRef,
        @SLRef, @PartySLCode, @GLRef, @AccountGroupRef,
        
        -- ✅ اصلاح منطق:
        -- اگر واریز است (isDeposit=true) -> مشتری پول داده -> مشتری بستانکار (Credit)
        -- اگر برداشت است (isDeposit=false) -> به تأمین‌کننده پول دادیم -> طرف حساب بدهکار (Debit)
        ${isDeposit ? "0" : "@Amount"},      -- Debit
        ${isDeposit ? "@Amount" : "0"},      -- Credit
        
        @Desc, 1, 0,
        CASE WHEN @DLLevel = 4 THEN @PartyDLCode ELSE NULL END,
        CASE WHEN @DLLevel = 4 THEN @DLTypeRef ELSE NULL END,
        CASE WHEN @DLLevel = 5 THEN @PartyDLCode ELSE NULL END,
        CASE WHEN @DLLevel = 5 THEN @DLTypeRef ELSE NULL END,
        CASE WHEN @DLLevel = 6 THEN @PartyDLCode ELSE NULL END,
        CASE WHEN @DLLevel = 6 THEN @DLTypeRef ELSE NULL END
    );

    -- 9. ردیف دوم: حساب بانک (همیشه معکوس طرف اول)
    EXEC @ReturnVal = [Sys3].[spGetNextId] 'FIN3.VoucherItem', @Id = @VoucherItemID2 OUTPUT;

    INSERT INTO [FIN3].[VoucherItem] (
        VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef,
        Debit, Credit, Description, RowNumber, IsCurrencyBased
    ) VALUES (
        @VoucherItemID2, @VoucherID, @BranchRef,
        @BankSLRef, @BankSLCode, @BankGLRef, @BankAccountGroupRef,
        
        -- ✅ اصلاح منطق:
        -- اگر واریز است -> پول آمده به بانک -> بانک بدهکار (Debit)
        -- اگر برداشت است -> پول رفته از بانک -> بانک بستانکار (Credit)
        ${isDeposit ? "@Amount" : "0"},      -- Debit
        ${isDeposit ? "0" : "@Amount"},      -- Credit
        
        N'بانک - ' + @Desc, 2, 0
    );

    ------------------------------------------------------------------
    -- 10. پایان و وضعیت موقت
    ------------------------------------------------------------------
    UPDATE [FIN3].[Voucher] SET State = 1 WHERE VoucherID = @VoucherID;

    COMMIT TRANSACTION;

    SELECT 'Success' AS Status, @VoucherNumber AS VoucherNum, @VoucherID AS VID;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR (@Err, 16, 1);
END CATCH;
`
        const sqlRes = await executeSql(insertNativeSql)

        if (sqlRes && sqlRes[0] && sqlRes[0].Status === "Success") {
          const voucherNum = sqlRes[0].VoucherNum
          console.log(
            `🎉 SUCCESS! Voucher Created: #${sqlRes[0].VoucherNum} (ID: ${sqlRes[0].VID})`
          )
          resultsTable.push({
            Name: partyName,
            Result: `Saved #${voucherNum} 🟢`
          })
          lastGeneratedDocId = voucherNum.toString()
        }
      } else {
        console.log(`🟡 Sending to Dashboard: ${partyName}`)
        await supabaseService.from("payment_requests").insert({
          workspace_id: workspaceId,
          amount: item.amount,
          supplier_name: partyName,
          description: rawDesc,
          status: "unspecified",
          transaction_date: payload.date
            ? new Date(payload.date).toISOString()
            : new Date().toISOString()
        })
        resultsTable.push({ Name: partyName, Result: "Sent to Manager 🟡" })
      }
    }

    console.table(resultsTable)
    return {
      success: true,
      message: "Processing Completed",
      docId: lastGeneratedDocId, // این فیلد باعث می‌شود در مودال "---" نمایش داده نشود
      results: resultsTable // لیست کامل برای استفاده‌های بعدی
    }
  } catch (error: any) {
    console.error(error)
    return { success: false, error: error.message }
  }
}
