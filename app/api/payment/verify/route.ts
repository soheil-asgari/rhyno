import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { ServerRuntime } from "next"

export const runtime: ServerRuntime = "edge"

const MANUAL_EXCHANGE_RATE = 1030000
const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const authority = searchParams.get("Authority")
  const status = searchParams.get("Status")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  if (status !== "OK" || !authority) {
    return NextResponse.redirect(`${siteUrl}/account?payment=failed`)
  }

  try {
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

    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("payment_gateway_ref", authority)
      .single()

    if (txError || !transaction) throw new Error("تراکنش یافت نشد")
    if (transaction.status === "completed")
      return NextResponse.redirect(
        `${siteUrl}/account?payment=already_verified`
      )

    const amountIRR = transaction.amount * MANUAL_EXCHANGE_RATE

    const verificationResponse = await fetch(
      "https://api.zarinpal.com/pg/v4/payment/verify.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          merchant_id: ZARINPAL_MERCHANT_ID,
          amount: amountIRR,
          authority: authority
        })
      }
    )

    const verificationData = await verificationResponse.json()

    if (
      verificationData.errors.length > 0 ||
      verificationData.data.code !== 100
    ) {
      throw new Error("تأیید پرداخت با شکست مواجه شد")
    }

    const refID = verificationData.data.ref_id

    await supabase
      .from("transactions")
      .update({ status: "completed", payment_gateway_ref: String(refID) })
      .eq("id", transaction.id)

    await supabase.rpc("add_user_credits", {
      p_user_id: transaction.user_id,
      p_amount_usd: transaction.amount
    })

    return NextResponse.redirect(`${siteUrl}/account?payment=success`)
  } catch (error: any) {
    console.error("Zarinpal Verify Error:", error)
    return NextResponse.redirect(`${siteUrl}/account?payment=failed`)
  }
}
