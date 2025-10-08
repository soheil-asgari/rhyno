import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const authority = searchParams.get("Authority")
  const status = searchParams.get("Status")

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

  if (txError || !transaction) {
    const url = new URL("/payment/status", request.url)
    url.searchParams.set("status", "failed")
    url.searchParams.set("message", "تراکنش یافت نشد.")
    return NextResponse.redirect(url)
  }

  if (status !== "OK") {
    await supabase
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("id", transaction.id)

    const url = new URL("/payment/status", request.url)
    url.searchParams.set("status", "failed")
    url.searchParams.set("message", "تراکنش توسط شما لغو شد.")
    return NextResponse.redirect(url)
  }

  try {
    const verifyResponse = await fetch(
      "https://api.zarinpal.com/pg/v4/payment/verify.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          merchant_id: ZARINPAL_MERCHANT_ID,
          authority: authority,
          amount: transaction.amount_irr
        })
      }
    )

    const verifyData = await verifyResponse.json()

    if (verifyData.data && verifyData.data.code === 100) {
      await supabase
        .from("transactions")
        .update({
          status: "completed",
          payment_gateway_ref: verifyData.data.ref_id
        })
        .eq("id", transaction.id)

      await supabase.rpc("increment_wallet_balance", {
        user_id_param: transaction.user_id,
        amount_param: transaction.amount
      })

      const url = new URL("/payment/status", request.url)
      url.searchParams.set("status", "success")
      url.searchParams.set("track_id", verifyData.data.ref_id)
      url.searchParams.set("amount", String(transaction.amount_irr / 10))
      return NextResponse.redirect(url)
    } else {
      await supabase
        .from("transactions")
        .update({ status: "failed", description: verifyData.errors.message })
        .eq("id", transaction.id)

      const url = new URL("/payment/status", request.url)
      url.searchParams.set("status", "failed")
      url.searchParams.set("message", verifyData.errors.message)
      return NextResponse.redirect(url)
    }
  } catch (error) {
    const url = new URL("/payment/status", request.url)
    url.searchParams.set("status", "failed")
    url.searchParams.set("message", "خطای داخلی سرور هنگام تایید تراکنش.")
    return NextResponse.redirect(url)
  }
}
