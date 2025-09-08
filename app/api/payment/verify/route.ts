import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const authority = searchParams.get("Authority")
  const status = searchParams.get("Status")
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  if (status !== "OK" || !authority) {
    return NextResponse.redirect(`${siteUrl}/account?payment=failed`)
  }

  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
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

    const amountIRR = transaction.amount_irr

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

    const refID = String(verificationData.data.ref_id)

    // ✨ فراخوانی تابع امن برای نهایی کردن پرداخت
    const { error: finalizeError } = await supabase.rpc("finalize_payment", {
      p_authority_code: authority,
      p_ref_id: refID
    })

    if (finalizeError) {
      console.error("!!! CRITICAL: DB Finalize Error !!!", finalizeError)
      throw new Error("خطای سیستمی در ثبت پرداخت")
    }

    return NextResponse.redirect(`${siteUrl}/payment/success?ref_id=${refID}`)
  } catch (error: any) {
    console.error("Zarinpal Verify Error:", error)
    return NextResponse.redirect(
      `${siteUrl}/account?payment=failed&error=${encodeURIComponent(error.message)}`
    )
  }
}
