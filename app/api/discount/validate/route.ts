import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { message: "کد تخفیف ارسال نشده است." },
        { status: 400 }
      )
    }

    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value
        }
      }
    )

    const { data: codeData, error: codeError } = await supabase
      .from("discount_codes")
      .select("*")
      .eq("code", code)
      .single()

    // اگر کد در دیتابیس پیدا نشود
    if (codeError || !codeData) {
      return NextResponse.json(
        { message: "کد تخفیف نامعتبر است." },
        { status: 404 }
      )
    }

    // بررسی فعال بودن کد
    if (!codeData.is_active) {
      return NextResponse.json(
        { message: "این کد تخفیف دیگر فعال نیست." },
        { status: 403 }
      )
    }

    // بررسی تاریخ انقضا (اگر وجود داشته باشد)
    if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
      return NextResponse.json(
        { message: "این کد تخفیف منقضی شده است." },
        { status: 403 }
      )
    }

    // اگر همه چیز درست بود، درصد تخفیف را برگردان
    return NextResponse.json({
      message: "کد تخفیف با موفقیت اعمال شد.",
      percentage: codeData.percentage
    })
  } catch (error) {
    console.error("Discount validation error:", error)
    return NextResponse.json({ message: "خطای داخلی سرور." }, { status: 500 })
  }
}
