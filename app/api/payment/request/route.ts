import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { Tables } from "@/supabase/types"

const MANUAL_EXCHANGE_RATE = 1030000
const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID

type DiscountCode = Tables<"discount_codes">

export async function POST(request: Request) {
  try {
    const { amountToman, discountCode } = await request.json()
    let originalAmountIRR = amountToman * 10
    let finalAmountIRR = originalAmountIRR // مبلغ نهایی در ابتدا برابر با مبلغ اصلی است
    let appliedDiscount: DiscountCode | null = null

    if (!originalAmountIRR || originalAmountIRR < 1000000) {
      return NextResponse.json({ message: "مبلغ نامعتبر است" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 401 })
    }

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

      const discountPercentage = codeData.percentage
      const discountAmount = (originalAmountIRR * discountPercentage) / 100
      finalAmountIRR = Math.round(originalAmountIRR - discountAmount)
      appliedDiscount = codeData
    }

    // ✅ محاسبه هر دو مبلغ به دلار
    const originalAmountUSD = originalAmountIRR / MANUAL_EXCHANGE_RATE

    // ✅ **نکته کلیدی:** از مبلغ اصلی برای ثبت در دیتابیس استفاده کنید
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        amount: originalAmountUSD, // مبلغ اصلی به دلار (برای منطق داخلی شما)
        amount_irr: originalAmountIRR, // ✅ مبلغ اصلی به ریال (برای شارژ حساب)
        paid_amount_irr: finalAmountIRR, // ✅ مبلغ پرداختی کاربر (برای تایید زرین‌پال)
        status: "pending"
      })
      .select()
      .single()

    if (txError) throw txError

    const description = `شارژ حساب کاربری - تراکنش ${transaction.id}`

    // ✅ **بدون تغییر:** از مبلغ نهایی برای ارسال به درگاه پرداخت استفاده کنید
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
          amount: finalAmountIRR, // <-- مبلغ نهایی (پرداختی کاربر) به درگاه ارسال می‌شود
          callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/verify`,
          description: description,
          metadata: { transaction_id: transaction.id, user_email: user.email }
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
