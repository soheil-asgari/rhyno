// FILE: app/api/views/[slug]/route.ts

import { kv } from "@vercel/kv"
import { NextResponse } from "next/server"

// این تابع درخواست POST از ViewCounter.tsx را مدیریت می‌کند
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug
  if (!slug) {
    return new Response("Slug is required", { status: 400 })
  }

  try {
    // "views" نام کلکسیون (hash) ما در Vercel KV است
    // slug همان کلید (key) ما است
    // 1 عددی است که به بازدید اضافه می‌کنیم
    const views = await kv.hincrby("views", slug, 1)

    // تعداد بازدید جدید را برمی‌گردانیم
    return NextResponse.json({ slug, views })
  } catch (error) {
    console.error("Error incrementing views:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}

// 💡 نکته: ما به تابع GET نیازی نداریم
// چون صفحه اصلی بلاگ (app/blog/page.tsx) مستقیماً با kv.hgetall()
// از دیتابیس می‌خواند که بسیار بهینه‌تر است.
