// app/api/bi/generate/route.ts
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import CryptoJS from "crypto-js"
import sql from "mssql"
import OpenAI from "openai"

export const dynamic = "force-dynamic"

const SECRET_KEY = process.env.DATA_ENCRYPTION_KEY || "my-secret-key-123"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  try {
    const { prompt, workspaceId } = await req.json()

    if (!prompt || !workspaceId) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data: connection } = await supabase
      .from("workspace_connections")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single()

    if (!connection) {
      return NextResponse.json({ error: "دیتابیسی متصل نیست" }, { status: 404 })
    }

    const bytes = CryptoJS.AES.decrypt(
      connection.encrypted_password,
      SECRET_KEY
    )
    const originalPassword = bytes.toString(CryptoJS.enc.Utf8)

    const config = {
      user: connection.username,
      password: originalPassword,
      server: connection.host,
      port: connection.port,
      database: connection.database_name,
      options: { encrypt: false, trustServerCertificate: true }
    }

    const pool = await sql.connect(config)

    const schemaQuery = `
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
    `
    const schemaResult = await pool.request().query(schemaQuery)
    const schemaDescription = schemaResult.recordset
      .map(
        row =>
          `Table: ${row.TABLE_NAME}, Column: ${row.COLUMN_NAME}, Type: ${row.DATA_TYPE}`
      )
      .join("\n")

    // 🧠 دستورالعمل جدید: درخواست خروجی JSON شامل نوع نمودار
    const systemPrompt = `
      You are an expert T-SQL Data Analyst. 
      
      Schema:
      ${schemaDescription}

      Your task is to generate a JSON response containing:
      1. "sql": A valid T-SQL query.
      2. "visualization": The best way to visualize this data. Options: 'bar', 'area', 'pie', 'table'.

      VISUALIZATION RULES:
      - **'table'**: If the user asks for a list, report, details, specific names, or status (e.g. "List of debtors", "Account balances").
      - **'bar'**: If comparing categories (e.g. "Sales by product").
      - **'area'**: If showing trends over time (e.g. "Monthly sales").
      - **'pie'**: If showing distribution/percentages.

      SQL RULES:
      - No markdown.
      - Do NOT hallucinate columns. Only use the provided schema.
      - Use DATEADD for time ranges.
    `

    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }, // فرمت جیسون اجباری
      temperature: 0
    })

    const responseContent = chatCompletion.choices[0].message.content || "{}"
    const aiResponse = JSON.parse(responseContent)

    const generatedSQL = aiResponse.sql
    const visualization = aiResponse.visualization || "table"

    console.log("🤖 SQL:", generatedSQL)
    console.log("📊 Recommended Viz:", visualization)

    const dataResult = await pool.request().query(generatedSQL)
    await pool.close()

    return NextResponse.json({
      sql: generatedSQL,
      visualization: visualization, // ارسال نوع نمودار به فرانت
      data: dataResult.recordset
    })
  } catch (error: any) {
    console.error("AI/DB Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
