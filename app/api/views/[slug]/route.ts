// FILE: app/api/views/[slug]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { kv } from "@vercel/kv"

interface Params {
  params: { slug: string }
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const views = await kv.hget("views", params.slug)
    return NextResponse.json({ views: views || 0 })
  } catch (error) {
    return NextResponse.json({ views: 0 }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    // 🟢 اصلاح شده: استفاده از hincrby به جای hincr
    // پارامتر سوم (1) یعنی یک واحد اضافه کن
    const views = await kv.hincrby("views", params.slug, 1)

    return NextResponse.json({ views })
  } catch (error) {
    console.error("KV Error:", error)
    return NextResponse.json({ error: "Error saving view" }, { status: 500 })
  }
}
