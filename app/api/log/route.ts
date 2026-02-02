// app/api/log/route.ts

import { NextResponse } from "next/server"

// مشخص می‌کنیم که این یک تابع Node.js است
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = body.message || "No message provided"

    // 🛑 مهم‌ترین بخش: لاگ در کنسول سرور Vercel چاپ می‌شود
    console.log(`[WEBVIEW_LOG]: ${message}`)

    // یک پاسخ موفقیت‌آمیز برمی‌گردانیم
    return NextResponse.json({ status: "logged" }, { status: 200 })
  } catch (error: any) {
    // در صورت بروز خطا در خود API لاگ
    console.error("[LOG_API_ERROR]:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
