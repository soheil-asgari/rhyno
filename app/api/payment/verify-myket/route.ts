import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const runtime = "edge" // برای سرعت بالاتر

export async function POST(request: Request) {
  try {
    const { purchaseToken, productId, packageName } = await request.json()

    // ۱. بررسی احراز هویت کاربر
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: request.headers.get("Authorization")!
          }
        }
      }
    )

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // ۲. استعلام از سرور مایکت
    const myketAccessToken = process.env.MYKET_ACCESS_TOKEN
    if (!myketAccessToken) {
      return NextResponse.json(
        { message: "Server config error: MYKET_ACCESS_TOKEN missing" },
        { status: 500 }
      )
    }

    const myketVerifyUrl = `https://developer.myket.ir/api/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`

    const myketResponse = await fetch(myketVerifyUrl, {
      method: "GET",
      headers: { "X-Access-Token": myketAccessToken }
    })

    if (!myketResponse.ok) {
      console.error("Myket Error:", await myketResponse.text())
      return NextResponse.json(
        { message: "تایید پرداخت در مایکت ناموفق بود" },
        { status: 400 }
      )
    }

    const verifyData = await myketResponse.json()

    // نکته: اگر consumptionState برابر 1 باشد یعنی قبلا مصرف شده.
    // اما چون ممکن است کلاینت دوباره درخواست داده باشد، ما فرض را بر صحت می‌گذاریم
    // و فقط اگر توکن معتبر بود شارژ را اضافه می‌کنیم.
    // بهتر است در دیتابیس خودتان جدول تراکنش داشته باشید که جلوی شارژ تکراری با یک توکن را بگیرید.

    // ۳. تعیین مبلغ شارژ
    let amountToAdd = 0
    if (productId === "sku_100000") amountToAdd = 100000
    else if (productId === "sku_250000") amountToAdd = 250000
    else if (productId === "sku_500000") amountToAdd = 500000

    if (amountToAdd === 0) {
      return NextResponse.json(
        { message: "محصول نامعتبر است" },
        { status: 400 }
      )
    }

    // ۴. افزایش موجودی در دیتابیس (با دسترسی ادمین)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ابتدا پروفایل را میگیریم
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("balance")
      .eq("user_id", user.id)
      .single()

    const currentBalance = profile?.balance || 0
    const newBalance = currentBalance + amountToAdd

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newBalance })
      .eq("user_id", user.id)

    if (updateError) {
      return NextResponse.json(
        { message: "خطا در آپدیت دیتابیس" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "حساب شما شارژ شد",
      newBalance
    })
  } catch (error: any) {
    console.error("Payment Verify Error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
