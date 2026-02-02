import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies, headers } from "next/headers" // 1. headers را import کنید
import { NextResponse } from "next/server"
import type { Tables } from "@/supabase/types"

const MANUAL_EXCHANGE_RATE = 1030000
const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID

type DiscountCode = Tables<"discount_codes">

export async function POST(request: Request) {
  try {
    const { amountToman, discountCode } = await request.json()
    let originalAmountIRR = amountToman * 10
    let finalAmountIRR = originalAmountIRR
    let appliedDiscount: DiscountCode | null = null

    if (!originalAmountIRR || originalAmountIRR < 1000000) {
      return NextResponse.json({ message: "مبلغ نامعتبر است" }, { status: 400 })
    }

    // --- ✅✅✅ شروع بخش اصلاح‌شده احراز هویت ✅✅✅ ---

    // 1. کلاینت سوپابیس را با کوکی‌ها می‌سازیم
    const cookieStore = cookies()
    const supabase = createSSRClient(cookieStore)

    // 2. ابتدا تلاش می‌کنیم کاربر را از کوکی‌ها بگیریم (برای وب)
    let {
      data: { user }
    } = await supabase.auth.getUser()

    // 3. اگر کاربری از کوکی پیدا نشد، هدر Authorization را بررسی می‌کنیم (برای موبایل)
    if (!user) {
      console.log("No user from cookies, checking auth header...") // (برای لاگ)
      const authHeader = headers().get("Authorization")

      if (authHeader) {
        const token = authHeader.split(" ")[1] // جدا کردن 'Bearer'
        if (token) {
          // 4. کاربر را با استفاده از توکن دریافتی پیدا می‌کنیم
          const {
            data: { user: tokenUser },
            error: tokenError
          } = await supabase.auth.getUser(token)

          if (tokenError) {
            console.error("Token Auth Error:", tokenError.message)
          } else if (tokenUser) {
            console.log("User found via token.") // (برای لاگ)
            user = tokenUser // کاربر پیدا شد
          }
        } else {
          console.log("Auth header found but no token.") // (برای لاگ)
        }
      } else {
        console.log("No auth header found.") // (برای لاگ)
      }
    } else {
      console.log("User found via cookies.") // (برای لاگ)
    }

    // 5. بررسی نهایی - اگر هیچ کاربری پیدا نشد، خطای 401 می‌دهیم
    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 401 })
    }

    // --- ✅✅✅ پایان بخش اصلاح‌شده احراز هویت ✅✅✅ ---

    if (discountCode) {
      const { data: codeData, error: codeError } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", discountCode)
        .single()

      if (codeError || !codeData) {
        return NextResponse.json(
          { message: "کد تخفیف نامعتبر است" },
          { status: 404 }
        )
      }

      if (!codeData.is_active) {
        return NextResponse.json(
          { message: "این کد تخفیف فعال نیست" },
          { status: 403 }
        )
      }

      const { data: usageData, error: usageError } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", user.id) // ✅ اکنون user.id معتبر است
        .eq("discount_code_id", codeData.id)
        .eq("status", "completed")
        .limit(1)
        .single()

      if (usageData) {
        return NextResponse.json(
          { message: "شما قبلاً از این کد تخفیف استفاده کرده‌اید" },
          { status: 403 } // 403 Forbidden
        )
      }

      const discountPercentage = codeData.percentage
      const discountAmount = (originalAmountIRR * discountPercentage) / 100
      finalAmountIRR = Math.round(originalAmountIRR - discountAmount)
      appliedDiscount = codeData
    }

    const originalAmountUSD = originalAmountIRR / MANUAL_EXCHANGE_RATE

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id, // ✅ اکنون user.id معتبر است
        amount: originalAmountUSD,
        amount_irr: originalAmountIRR,
        status: "pending",
        discount_code_id: appliedDiscount ? appliedDiscount.id : null
      })
      .select()
      .single()

    if (txError) throw txError

    const description = `شارژ حساب کاربری - تراکنش ${transaction.id}`

    const zarinpalResponse = await fetch(
      "https://api.zarinpal.com/pg/v4/payment/request.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          merchant_id: ZARINPAL_MERCHANT_ID,
          amount: finalAmountIRR,
          callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/verify`,
          description: description,
          metadata: { transaction_id: transaction.id, user_email: user.email } // ✅ اکنون user.email معتبر است
        })
      }
    )

    const zarinpalData = await zarinpalResponse.json()
    if (zarinpalData.errors.length > 0 || !zarinpalData.data.authority) {
      throw new Error(JSON.stringify(zarinpalData.errors))
    }

    await supabase
      .from("transactions")
      .update({ payment_gateway_ref: zarinpalData.data.authority })
      .eq("id", transaction.id)

    const paymentUrl = `https://www.zarinpal.com/pg/StartPay/${zarinpalData.data.authority}`

    return NextResponse.json({ paymentLink: paymentUrl })
  } catch (error: any) {
    console.error("Zarinpal Request Error:", error)
    return NextResponse.json(
      { message: "خطا در ایجاد درخواست پرداخت: " + error.message },
      { status: 500 }
    )
  }
}
