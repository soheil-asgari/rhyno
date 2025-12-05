import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"



export interface RahkaranSyncResult {
  success: boolean;
  docId?: string;
  error?: string;
  message?: string;
  party?: string; // ✅ اضافه شد
  sl?: string;    // ✅ اضافه شد
}



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
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${level}] ${timestamp} ➤ ${message}`);
  try {
    supabase.from("Rhyno_DebugLog").insert([{
      level,
      message,
      data: data ? JSON.stringify(data) : null
    }]).then(() => { });
  } catch (e) { }
}

async function executeSql(sql: string) {
  const proxyRes = await fetch(PROXY_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-proxy-key": PROXY_KEY! },
    body: JSON.stringify({ query: sql })
  });
  const responseText = await proxyRes.text();
  let proxyData;
  try { proxyData = JSON.parse(responseText); } catch (e) { throw new Error(`Proxy JSON Error: ${responseText.substring(0, 100)}`); }

  if (!proxyRes.ok || !proxyData.success) {
    throw new Error(`SQL Error: ${proxyData.error || proxyData.message}`);
  }
  return proxyData.recordset || [];
}

interface SyncPayload {
  mode: 'deposit' | 'withdrawal';
  date: string;
  description: string;
  totalAmount: number;
  branchId?: number;
  items: {
    partyName: string;
    amount: number;
    desc?: string;
    tracking?: string;
  }[];
}



// در فایل lib/services/rahkaran.ts

// تابع کمکی برای پیدا کردن کد تفصیلی یا معین
async function findAccountCode(partyName: string): Promise<{ dlCode?: string, dlType?: number, slId?: number, foundName: string }> {
  // تمیزکاری اسم
  const cleanName = partyName.trim();
  if (!cleanName || cleanName === "نامشخص") return { foundName: "نامشخص" };

  // استخراج کلمات کلیدی با AI (اختیاری - برای سرعت بیشتر می‌توان حذف کرد یا ساده‌سازی کرد)
  // فعلاً فرض می‌کنیم اسم ورودی کافی است، اما می‌توان اینجا هم AI گذاشت.

  const sqlSearch = `
    SET NOCOUNT ON;
    DECLARE @RawName nvarchar(500) = N'${escapeSql(cleanName)}';
    -- نرمال‌سازی
    SET @RawName = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(@RawName, N'ي', N'ی'), N'ك', N'ک'), N'ئ', N'ی'), N'آ', N'ا'), N'أ', N'ا');
    SET @RawName = REPLACE(@RawName, N' ', N'%'); 

    DECLARE @FoundDLCode nvarchar(50) = NULL;
    DECLARE @FoundDLType bigint = NULL;
    DECLARE @FoundSLID bigint = NULL;
    DECLARE @FoundTitle nvarchar(500) = NULL;

    -- 1. جستجوی هوشمند تفصیلی
    SELECT TOP 1 
        @FoundDLCode = Code, 
        @FoundDLType = DLTypeRef,
        @FoundTitle = Title 
    FROM (
        SELECT TOP 5 Code, DLTypeRef, Title,
            (CASE WHEN CleanTitle LIKE N'%'+ @RawName +'%' THEN 60 ELSE 0 END) as Score
        FROM (
            SELECT Code, DLTypeRef, Title, 
                REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(Title, N'ي', N'ی'), N'ك', N'ک'), N'ئ', N'ی'), N'آ', N'ا'), N'أ', N'ا') as CleanTitle
            FROM [FIN3].[DL]
            WHERE REPLACE(REPLACE(REPLACE(Title, N'ي', N'ی'), N'ك', N'ک'), N'ئ', N'ی') LIKE N'%'+ @RawName +'%'
        ) as T ORDER BY Score DESC
    ) as BestMatch;

    -- 2. جستجوی معین (اگر تفصیلی نبود)
    IF @FoundDLCode IS NULL
    BEGIN
         SELECT TOP 1 @FoundSLID = SLID, @FoundTitle = Title 
         FROM [FIN3].[SL] 
         WHERE (REPLACE(REPLACE(Title, N'ي', N'ی'), N'ك', N'ک') LIKE N'%'+ @RawName +'%')
         AND CAST(SLID AS VARCHAR(50)) NOT IN (N'111003', N'111005') AND Code NOT LIKE '111%'; 
    END

    SELECT @FoundDLCode as DLCode, @FoundDLType as DLType, @FoundSLID as SLID, @FoundTitle as FoundTitle;
    `;

  const res = await executeSql(sqlSearch);
  const row = res[0] || {};
  return {
    dlCode: row.DLCode,
    dlType: row.DLType,
    slId: row.SLID,
    foundName: row.FoundTitle || cleanName
  };
}

export async function syncToRahkaranSystem(payload: SyncPayload): Promise<RahkaranSyncResult> {
  try {
    await logToDb("INFO", `🚀 STARTING SMART VOUCHER SYNC`, { itemsCount: payload.items.length });

    const { mode, items, description, totalAmount, date } = payload;
    const isDeposit = mode === 'deposit';
    const defaultSLCode = isDeposit ? '21901' : '11901'; // پیش‌فرض

    let itemsSqlBlock = "";
    let rowIndex = 1;

    // 1. مرحله پیش‌پردازش: پیدا کردن کدها قبل از ساخت کوئری اصلی
    // این حلقه "async" است و منتظر می‌ماند تا هر اکانت پیدا شود
    for (const item of items) {
      const partyName = item.partyName || "نامشخص";
      const itemAmount = item.amount;
      const itemDesc = escapeSql(item.desc || description);

      // تشخیص کارمزد (بدون نیاز به دیتابیس)
      const isFee = partyName.includes("کارمزد") || itemDesc.includes("کارمزد");

      let targetDLCode = "NULL";
      let targetDLType = "NULL";
      let targetSLID = "NULL"; // اگر نال باشد، در SQL محاسبه می‌شود
      let comment = "-- پیدا شده با هوش مصنوعی";

      if (isFee) {
        // اگر کارمزد است، کد معین هزینه بانکی را می‌گذاریم (باید در دیتابیس چک کنید کدش چیست)
        // فرض: 921145
        // برای اطمینان، می‌گذاریم SQL در مرحله بعد پیدایش کند، یا اینجا هاردکد می‌کنیم
        comment = "-- هزینه کارمزد";
        // ما اینجا SLID را خالی می‌گذاریم و در کوئری پایین شرط می‌گذاریم
      } else {
        // جستجوی دقیق در دیتابیس
        const foundAccount = await findAccountCode(partyName);

        if (foundAccount.dlCode) {
          targetDLCode = `N'${foundAccount.dlCode}'`;
          targetDLType = `${foundAccount.dlType}`;
          comment = `-- ${foundAccount.foundName}`;
        } else if (foundAccount.slId) {
          targetSLID = `${foundAccount.slId}`;
          comment = `-- معین: ${foundAccount.foundName}`;
        }
      }

      const iDebit = isDeposit ? '0' : `${itemAmount}`;
      const iCredit = isDeposit ? `${itemAmount}` : '0';

      // ساخت بلوک SQL برای این ردیف
      itemsSqlBlock += `
        -- Item ${rowIndex}: ${partyName} ${comment}
        SET @SLRef = ${targetSLID};
        SET @FoundDLCode = ${targetDLCode};
        SET @FoundDLType = ${targetDLType};
        
        -- اگر کارمزد بود
        IF ${isFee ? '1=1' : '0=1'}
        BEGIN
             SELECT TOP 1 @SLRef = SLID FROM [FIN3].[SL] WHERE Code = '921145'; -- هزینه بانکی
             SET @FoundDLCode = NULL;
        END
        
        -- اگر تفصیلی داشتیم، معینش را پیدا کن (مگر اینکه قبلا پر شده باشد)
        IF @FoundDLCode IS NOT NULL AND @SLRef IS NULL
        BEGIN
             -- جستجو در سابقه (با کد پیدا شده)
             IF ${isDeposit ? '1=1' : '0=1'} 
                 SELECT TOP 1 @SLRef = SLRef FROM [FIN3].[VoucherItem] VI WHERE (VI.DLLevel4 = @FoundDLCode OR VI.DLLevel5 = @FoundDLCode) AND ISNULL(VI.Credit, 0) > 0 ORDER BY VoucherItemID DESC;
             ELSE 
                 SELECT TOP 1 @SLRef = SLRef FROM [FIN3].[VoucherItem] VI WHERE (VI.DLLevel4 = @FoundDLCode OR VI.DLLevel5 = @FoundDLCode) AND ISNULL(VI.Debit, 0) > 0 ORDER BY VoucherItemID DESC;

             -- اگر سابقه نبود، از ارتباطات
             IF @SLRef IS NULL
                 SELECT TOP 1 @SLRef = SLRef FROM [FIN3].[DLTypeRelation] WHERE DLTypeRef = @FoundDLType;
        END

        -- فال‌بک نهایی (اگر هنوز معین نداریم)
        IF @SLRef IS NULL
        BEGIN
            SELECT TOP 1 @SLRef = SLID FROM [FIN3].[SL] WHERE Code = '${defaultSLCode}';
            IF @SLRef IS NULL SET @SLRef = 111003; 
        END

        -- دریافت GL و AG
        SELECT @GLRef = GLRef, @SLCode = Code FROM [FIN3].[SL] WHERE SLID = @SLRef;
        SELECT @AGRef = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @GLRef;

        -- درج
        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @ItemID OUTPUT, 1, 0;
        INSERT INTO [FIN3].[VoucherItem]
        (VoucherItemID, VoucherRef, BranchRef, SLRef, GLRef, AccountGroupRef, SLCode, Debit, Credit, Description, RowNumber, IsCurrencyBased, DLLevel4, DLTypeRef4)
        VALUES 
        (@ItemID, @VoucherID, @BranchRef, @SLRef, @GLRef, @AGRef, @SLCode, ${iDebit}, ${iCredit}, N'${itemDesc}', ${rowIndex}, 0, @FoundDLCode, @FoundDLType);
        `;

      rowIndex++;
    }


    // 2. کوئری نهایی
    const bankDebit = isDeposit ? `${totalAmount}` : '0';
    const bankCredit = isDeposit ? '0' : `${totalAmount}`;

    const sql = `
    SET NOCOUNT ON;
    DECLARE @Date datetime = CAST('${date}' AS DATETIME); 
    DECLARE @VoucherID bigint, @ItemID bigint;
    DECLARE @NewNum int, @NewSeq int, @NewDailyNum int;
    DECLARE @SLRef bigint, @GLRef bigint, @AGRef bigint, @SLCode nvarchar(50);
    DECLARE @FoundDLCode nvarchar(50);
    DECLARE @FoundDLType bigint;

    DECLARE @BranchRef bigint = 1; 
    DECLARE @LedgerRef bigint = 1; 
    DECLARE @FiscalYearRef bigint;
    SELECT TOP 1 @FiscalYearRef = FiscalYearID FROM [GNR3].[FiscalYear] ORDER BY FiscalYearID DESC;

    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Header
        EXEC [Sys3].[spGetNextId] 'FIN3.Voucher', @VoucherID OUTPUT, 1, 0;
        SELECT @NewNum = ISNULL(MAX(Number), 0) + 1 FROM [FIN3].[Voucher] WHERE LedgerRef=@LedgerRef AND FiscalYearRef=@FiscalYearRef;
        SELECT @NewSeq = ISNULL(MAX(Sequence), 0) + 1 FROM [FIN3].[Voucher] WHERE BranchRef=@BranchRef AND FiscalYearRef=@FiscalYearRef AND LedgerRef=@LedgerRef;
        SELECT @NewDailyNum = ISNULL(MAX(DailyNumber), 0) + 1 FROM [FIN3].[Voucher] WHERE BranchRef=@BranchRef AND LedgerRef=@LedgerRef AND FiscalYearRef=@FiscalYearRef AND CAST(Date AS DATE) = CAST(@Date AS DATE);

        INSERT INTO [FIN3].[Voucher]
        (VoucherID, BranchRef, FiscalYearRef, LedgerRef, VoucherTypeRef, Number, Date, Description, State, IsTemporary, Creator, LastModifier, CreationDate, LastModificationDate, Sequence, DailyNumber, IsCurrencyBased, IsExternal, IsReadOnly, ShowCurrencyFields)
        VALUES 
        (@VoucherID, @BranchRef, @FiscalYearRef, @LedgerRef, 1, @NewNum, @Date, N'${escapeSql(description)}', 1, 0, 1, 1, GETDATE(), GETDATE(), @NewSeq, @NewDailyNum, 0, 0, 0, 0);

        -- Items (Generated by JS)
        ${itemsSqlBlock}

        -- Bank Item
        DECLARE @BankSL bigint = 111005;
        DECLARE @BankGL bigint, @BankAG bigint, @BankSLCode nvarchar(50);
        SELECT @BankGL = GLRef, @BankSLCode = Code FROM [FIN3].[SL] WHERE SLID = @BankSL;
        SELECT @BankAG = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @BankGL;

        EXEC [Sys3].[spGetNextId] 'FIN3.VoucherItem', @ItemID OUTPUT, 1, 0;
        INSERT INTO [FIN3].[VoucherItem]
        (VoucherItemID, VoucherRef, BranchRef, SLRef, GLRef, AccountGroupRef, SLCode, Debit, Credit, Description, RowNumber, IsCurrencyBased)
        VALUES 
        (@ItemID, @VoucherID, @BranchRef, @BankSL, @BankGL, @BankAG, @BankSLCode, ${bankDebit}, ${bankCredit}, N'جمع سند شماره ' + CAST(@NewNum AS NVARCHAR), ${rowIndex}, 0);

        COMMIT TRANSACTION;
        SELECT @VoucherID as NewDocId;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
    `;

    const insertRes = await executeSql(sql);
    const result = insertRes[0] || {};

    if (result.NewDocId) {
      await logToDb("SUCCESS", `✅ Daily Voucher Created. ID: ${result.NewDocId}`);
      return {
        success: true,
        docId: result.NewDocId,
        party: "سند تجمیعی",
        sl: "---",
        message: "سند با موفقیت ثبت شد."
      };
    } else {
      throw new Error("No Voucher ID returned.");
    }

  } catch (error: any) {
    console.error(`❌ [SYNC ERROR]: ${error.message}`);
    return { success: false, error: error.message };
  }
}