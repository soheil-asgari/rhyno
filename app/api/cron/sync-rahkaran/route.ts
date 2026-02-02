import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 300
export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://rhyno.ir",
    "X-Title": "Rhyno Automation"
  }
})

const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b"

async function executeRahkaranSql(sql: string) {
  // استفاده از متغیر محیطی برای آدرس پل (Bridge) جدید
  const proxyRes = await fetch(process.env.RAHKARAN_PROXY_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-proxy-key": process.env.RAHKARAN_PROXY_KEY!
    },
    body: JSON.stringify({ query: sql })
  })
  if (!proxyRes.ok) throw new Error(`Rahkaran Proxy Error: ${proxyRes.status}`)
  const data = await proxyRes.json()
  return data.recordset || []
}

export async function GET(req: NextRequest) {
  try {
    console.log("🔄 Starting Smart Sync Job...")

    // 1. دریافت دیتای موجود برای مقایسه
    const { data: existingRecords, error: fetchError } = await supabase
      .from("rahkaran_entities")
      .select("dl_code, title")

    if (fetchError) throw fetchError
    const existingMap = new Map(
      existingRecords?.map(rec => [rec.dl_code, rec.title])
    )

    // 2. دریافت لیست از راهکاران (از طریق سرور واسط)
    const rahkaranAccounts = await executeRahkaranSql(
      `SELECT Code, DLTypeRef, Title FROM [FIN3].[DL] WHERE State = 1`
    )

    // 3. فیلتر کردن تغییرات
    const toProcess = rahkaranAccounts.filter((acc: any) => {
      const existingTitle = existingMap.get(acc.Code)
      return existingTitle === undefined || existingTitle !== acc.Title
    })

    console.log(`⚡ Items to process: ${toProcess.length}`)

    if (toProcess.length === 0) {
      return NextResponse.json({ message: "Everything is up to date." })
    }

    let successCount = 0
    let errorCount = 0

    // 4. پردازش دسته‌ای برای جلوگیری از Timeout (دسته های 20 تایی)
    const BATCH_SIZE = 20
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE)
      const batchTitles = batch.map((acc: any) =>
        acc.Title.replace(/\s+/g, " ").trim()
      )

      try {
        // تولید امبدینگ به صورت Batch (بسیار سریعتر)
        const embeddingRes = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: batchTitles
        })

        const upsertData = batch.map((acc: any, index: number) => ({
          dl_code: acc.Code,
          dl_type: acc.DLTypeRef,
          title: acc.Title,
          embedding: embeddingRes.data[index].embedding,
          updated_at: new Date().toISOString()
        }))

        // ذخیره دسته‌ای در سوپابیس
        const { error: upsertError } = await supabase
          .from("rahkaran_entities")
          .upsert(upsertData, { onConflict: "dl_code" })

        if (upsertError) throw upsertError

        successCount += batch.length
        console.log(`✅ Batched synced: ${batch.length} items`)
      } catch (err: any) {
        console.error(`❌ Batch error at index ${i}:`, err.message)
        errorCount += batch.length
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total_rahkaran: rahkaranAccounts.length,
        processed: successCount,
        errors: errorCount,
        skipped: rahkaranAccounts.length - toProcess.length
      }
    })
  } catch (error: any) {
    console.error("Sync Error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
