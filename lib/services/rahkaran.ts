import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

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

// ✅ 1. تابع کمکی برای جلوگیری از خراب شدن SQL با کاراکتر '
function escapeSql(str: string | undefined | null): string {
  if (!str) return ""
  return str.replace(/'/g, "''") // تبدیل ' به '' در SQL استاندارد است
}

async function logToDb(level: string, message: string, data: any = null) {
  try {
    console.log(`[${level}] ${message}`)
    await supabase.from("Rhyno_DebugLog").insert([
      {
        level,
        message,
        data: data ? JSON.stringify(data) : null
      }
    ])
  } catch (e) {
    console.error("Log Error:", e)
  }
}

export async function syncToRahkaranSystem(transactionData: any) {
  try {
    await logToDb("INFO", `Starting Sync Process`, transactionData)

    const branchId = transactionData.branchId || 1
    const fiscalYearId = transactionData.fiscalYearId || 106
    const ledgerId = transactionData.ledgerId || 1
    const voucherTypeRef = 1
    const items = transactionData.items || []

    // ✅ پاکسازی ورودی‌ها قبل از ارسال به پرامپت
    const safeHeaderDesc = escapeSql(transactionData.description)

    const prompt = `
      You are a Senior DBA for "SystemGroup Rahkaran". 
      Generate a CLEAN T-SQL script to insert a voucher.
      RETURN ONLY JSON. NO MARKDOWN.

      **Data:**
      Header Desc: '${safeHeaderDesc}'
      Items: ${JSON.stringify(items)}

      **Required T-SQL Structure (Strict Syntax):**
      DECLARE @VoucherID bigint;
      DECLARE @ItemID bigint;
      DECLARE @Date datetime = GETDATE();
      DECLARE @NewSequence int;
      DECLARE @NewNumber int;
      
      -- Variables for Item Processing
      DECLARE @CurrentSLRef bigint;
      DECLARE @CurrentSLCode nvarchar(50);
      DECLARE @FoundGLRef bigint;
      DECLARE @FoundAGRef bigint;

      BEGIN TRY
          BEGIN TRANSACTION;
            
            -- 1. Get Number & Sequence
            SELECT @NewSequence = ISNULL(MAX([Sequence]), 0) + 1 FROM [FIN3].[Voucher] WHERE BranchRef=${branchId} AND FiscalYearRef=${fiscalYearId} AND LedgerRef=${ledgerId};
            SELECT @NewNumber = ISNULL(MAX([Number]), 0) + 1 FROM [FIN3].[Voucher] WHERE LedgerRef=${ledgerId} AND FiscalYearRef=${fiscalYearId};

            -- 2. Insert Header
            EXEC [SYS3].[spGetNextId] @TableName = 'FIN3.Voucher', @Id = @VoucherID OUTPUT, @IncValue = 1, @IsLegacy = 0;
            
            INSERT INTO [FIN3].[Voucher] 
            (VoucherID, VoucherTypeRef, BranchRef, FiscalYearRef, LedgerRef, Date, Description, State, IsTemporary, IsCurrencyBased, IsExternal, IsReadonly, ShowCurrencyFields, Creator, CreationDate, LastModifier, LastModificationDate, Number, DailyNumber, Sequence)
            VALUES 
            (@VoucherID, ${voucherTypeRef}, ${branchId}, ${fiscalYearId}, ${ledgerId}, @Date, N'${safeHeaderDesc}', 1, 0, 0, 0, 0, 0, 1, @Date, 1, @Date, @NewNumber, 0, @NewSequence);

          -- 3. Items Loop
            ${items
              .map((item: any, index: number) => {
                const safeDesc = escapeSql(item.description)
                const safeParty = escapeSql(item.partyName)
                return `
            -------------------------------------------------------
            -- Item ${index + 1}
            -------------------------------------------------------
            SET @CurrentSLRef = ${item.moinCode ? item.moinCode : "NULL"};
            SET @CurrentSLCode = ${item.moinCode ? `N'${item.moinCode}'` : "NULL"};

            IF @CurrentSLRef IS NULL
            BEGIN
                SELECT TOP 1 @CurrentSLRef = SLID, @CurrentSLCode = Code 
                FROM [FIN3].[SL] 
                WHERE Title LIKE N'%${safeParty || safeDesc}%';
                
                IF @CurrentSLRef IS NULL 
                BEGIN
                    SET @CurrentSLRef = 111003; -- Default Cash
                    SET @CurrentSLCode = N'111003';
                END
            END
            ELSE
            BEGIN
                 SELECT TOP 1 @CurrentSLCode = Code FROM [FIN3].[SL] WHERE SLID = @CurrentSLRef;
            END

            SELECT TOP 1 @FoundGLRef = GLRef FROM [FIN3].[SL] WHERE SLID = @CurrentSLRef;
            SELECT TOP 1 @FoundAGRef = AccountGroupRef FROM [FIN3].[GL] WHERE GLID = @FoundGLRef;

            IF @FoundGLRef IS NULL SET @FoundGLRef = 1110; 
            IF @FoundAGRef IS NULL SET @FoundAGRef = 11;   

            EXEC [SYS3].[spGetNextId] @TableName = 'FIN3.VoucherItem', @Id = @ItemID OUTPUT, @IncValue = 1, @IsLegacy = 0;
            
            INSERT INTO [FIN3].[VoucherItem] 
            (VoucherItemID, VoucherRef, BranchRef, SLRef, SLCode, GLRef, AccountGroupRef, Debit, Credit, Description, RowNumber, IsCurrencyBased, IsTaxPrepaymentUnrefundable, IsTollPrepaymentUnrefundable)
            VALUES 
            (@ItemID, @VoucherID, ${branchId}, @CurrentSLRef, @CurrentSLCode, @FoundGLRef, @FoundAGRef, ${item.type === "Debtor" ? item.amount : 0}, ${item.type === "Creditor" ? item.amount : 0}, N'${safeDesc}', ${index + 1}, 0, 0, 0);
            `
              })
              .join("\n")}
            
            COMMIT TRANSACTION;
            SELECT @VoucherID as NewDocId;
      END TRY
      BEGIN CATCH
          IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
          SELECT ERROR_MESSAGE() as ErrorMsg;
      END CATCH;

      **Output JSON:** {"sql": "THE_RAW_SQL_CODE", "analysis": "brief summary"}
    `

    // Call OpenAI
    console.log("🧠 Generating SQL Logic...")
    const aiResponse = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const result = JSON.parse(aiResponse.choices[0].message.content || "{}")
    let cleanSql = result.sql
      .replace(/```sql/g, "")
      .replace(/```/g, "")
      .trim()

    // ✅ لاگ کردن کوئری واقعی برای دیباگ (بسیار مهم)
    console.log("--------------- GENERATED SQL ---------------")
    console.log(cleanSql)
    console.log("---------------------------------------------")

    await logToDb("AI_GEN", "SQL Generated", { analysis: result.analysis })

    // Call Proxy
    console.log("🚀 Sending SQL to Windows Proxy...")
    const proxyRes = await fetch(PROXY_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-proxy-key": PROXY_KEY!
      },
      body: JSON.stringify({ query: cleanSql })
    })

    // ✅ خواندن متن خطا حتی در صورت وضعیت غیر 200
    const proxyText = await proxyRes.text()
    let proxyData
    try {
      proxyData = JSON.parse(proxyText)
    } catch (e) {
      throw new Error(`Proxy Parse Error: ${proxyText}`)
    }

    if (!proxyRes.ok) {
      throw new Error(
        `Proxy Error (${proxyRes.status}): ${proxyData.error || proxyText}`
      )
    }

    if (
      proxyData.success &&
      proxyData.recordset &&
      proxyData.recordset.length > 0
    ) {
      const firstRow = proxyData.recordset[0]

      // ✅ بررسی خطای منطقی SQL
      if (firstRow.ErrorMsg) {
        throw new Error(`SQL Logic Error: ${firstRow.ErrorMsg}`)
      }

      await logToDb("SUCCESS", "Voucher Created", { docId: firstRow.NewDocId })
      return {
        success: true,
        docId: firstRow.NewDocId,
        message: "سند با موفقیت ثبت شد",
        analysis: result.analysis
      }
    } else {
      // خطایی که از دیتابیس برگشته اما فرمت استاندارد ندارد
      const errorDetail = proxyData.error || JSON.stringify(proxyData)
      throw new Error(`Database Error: ${errorDetail}`)
    }
  } catch (error: any) {
    console.error("❌ Transaction Failed:", error)
    await logToDb("ERROR", "Operation Failed", { error: error.message })
    return { success: false, error: error.message }
  }
}
