import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

// لیست محصولات و قیمت‌ها (باید با پنل مایکت یکی باشد)
const PRODUCTS: Record<string, number> = {
  sku_100000: 100000,
  sku_250000: 250000,
  sku_500000: 500000
}

export async function POST(request: Request) {
  try {
    const { purchaseToken, productId, packageName } = await request.json()

    // 1. اعتبارسنجی ورودی‌ها
    if (!purchaseToken || !productId || !packageName) {
      return NextResponse.json(
        { message: "اطلاعات خرید ناقص است" },
        { status: 400 }
      )
    }

    // 2. احراز هویت کاربر (User Auth)
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

    // 3. ساخت کلاینت ادمین (برای دسترسی به دیتابیس بدون محدودیت RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 4. *** مهم ***: چک کردن اینکه آیا این توکن قبلاً استفاده شده است؟
    // اگر توکن در دیتابیس باشد، یعنی قبلاً شارژ شده.
    const { data: existingTransaction } = await supabaseAdmin
      .from("payment_transactions")
      .select("id")
      .eq("purchase_token", purchaseToken)
      .single()

    if (existingTransaction) {
      // اگر قبلاً ثبت شده، پیام موفقیت الکی می‌دهیم که کلاینت خیالش راحت شود و ارور ندهد
      // یا می‌توانیم ارور بدهیم. اینجا فرض می‌کنیم موفق است چون پول قبلاً واریز شده.
      return NextResponse.json({
        success: true,
        message: "این خرید قبلاً ثبت شده است."
      })
    }

    // 5. استعلام از سرور مایکت برای تایید نهایی
    const myketAccessToken = process.env.MYKET_ACCESS_TOKEN
    if (!myketAccessToken) {
      console.error("MYKET_ACCESS_TOKEN is missing in .env")
      return NextResponse.json(
        { message: "Server configuration error" },
        { status: 500 }
      )
    }

    const myketVerifyUrl = `https://developer.myket.ir/api/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`

    const myketResponse = await fetch(myketVerifyUrl, {
      method: "GET",
      headers: { "X-Access-Token": myketAccessToken }
    })

    if (!myketResponse.ok) {
      const errorText = await myketResponse.text()
      console.error("Myket Verify Error:", errorText)
      return NextResponse.json(
        { message: "تایید خرید از سمت مایکت ناموفق بود." },
        { status: 400 }
      )
    }

    const verifyData = await myketResponse.json()

    // purchaseState: 0 (پرداخت موفق), 1 (لغو شده), 2 (بازپرداخت شده)
    if (verifyData.purchaseState !== 0) {
      return NextResponse.json(
        { message: "وضعیت خرید معتبر نیست (لغو شده یا ناموفق)." },
        { status: 400 }
      )
    }

    // 6. محاسبه مبلغ بر اساس محصول
    const amountToAdd = PRODUCTS[productId] || 0

    if (amountToAdd === 0) {
      return NextResponse.json(
        { message: "محصول انتخاب شده نامعتبر است" },
        { status: 400 }
      )
    }

    // 7. عملیات دیتابیس: ثبت تراکنش + افزایش موجودی
    // بهتر است اگر این بخش در Transaction SQL انجام شود اما اینجا جداگانه می‌زنیم

    // الف) ثبت توکن در جدول تراکنش‌ها (برای جلوگیری از تکرار در آینده)
    const { error: insertError } = await supabaseAdmin
      .from("payment_transactions")
      .insert({
        user_id: user.id,
        purchase_token: purchaseToken,
        product_id: productId,
        amount: amountToAdd,
        gateway: "myket"
      })

    if (insertError) {
      // اگر اینجا ارور unique constraint بدهد یعنی همزمان دو درخواست آمده
      console.error("Transaction Insert Error:", insertError)
      return NextResponse.json(
        { message: "خطا در ثبت تراکنش" },
        { status: 500 }
      )
    }

    // ب) افزایش موجودی کاربر
    // ابتدا موجودی فعلی را می‌خوانیم (بهتر است از RPC استفاده شود ولی این روش هم در ترافیک پایین کار می‌کند)
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
      console.error("Balance Update Error:", updateError)
      // اینجا وضعیت بحرانی است: تراکنش ثبت شده ولی پول اضافه نشده.
      // در سیستم‌های واقعی باید مکانیزم Rollback داشته باشید.
      return NextResponse.json(
        { message: "خطا در بروزرسانی موجودی. با پشتیبانی تماس بگیرید." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "حساب شما با موفقیت شارژ شد",
      newBalance
    })
  } catch (error: any) {
    console.error("Verify API Exception:", error)
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    )
  }
}
