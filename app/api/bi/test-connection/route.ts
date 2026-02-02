import { NextResponse } from "next/server"
import sql from "mssql"
import { Client } from "pg"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type, host, port, username, password, database } = body

    // 1. SQL Server
    if (type === "mssql") {
      const config = {
        user: username,
        password: password,
        server: host,
        port: parseInt(port) || 1433,
        database: database,
        options: {
          encrypt: false, // برای لوکال هاست
          trustServerCertificate: true
        }
      }
      const pool = await sql.connect(config)
      await pool.close()
      return NextResponse.json({ success: true })
    }

    // 2. PostgreSQL
    if (type === "postgres") {
      const client = new Client({
        host,
        port: parseInt(port),
        user: username,
        password,
        database
      })
      await client.connect()
      await client.end()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({
      success: false,
      error: "نوع دیتابیس پشتیبانی نمی‌شود"
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
