import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ServerRuntime } from "next"

export const runtime: ServerRuntime = "edge"

// ✨ نرخ ثابت دلار به ریال
const MANUAL_EXCHANGE_RATE = 1030000
const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID

export async function POST(request: Request) {
  try {
    const { amountToman } = await request.json()
    const amountIRR = amountToman * 10

    if (!amountIRR || amountIRR < 1000000) {
      return NextResponse.json({ message: "مبلغ نامعتبر است" }, { status: 400 })
    }

    // ✨ اصلاح کلیدی: استفاده از الگوی جدید createServerClient
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options })
          }
        }
      }
    )

    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 401 })
    }

    const amountUSD = amountIRR / MANUAL_EXCHANGE_RATE

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        amount: amountUSD,
        status: "pending"
      })
      .select()
      .single()

    if (txError) throw txError

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
          amount: amountIRR,
          callback_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/verify`,
          description: `شارژ حساب کاربری به مبلغ ${amountToman.toLocaleString("fa-IR")} تومان`,
          metadata: { transaction_id: transaction.id }
        })
      }
    )

    const zarinpalData = await zarinpalResponse.json()

    if (zarinpalData.errors.length > 0 || !zarinpalData.data.authority) {
      throw new Error("خطا در ارتباط با درگاه پرداخت")
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
