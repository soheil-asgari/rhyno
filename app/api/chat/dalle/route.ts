// in /api/dalle/route.ts

import { NextResponse } from "next/server"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"
import { handleDalleRequest } from "@/lib/dalle-handler"
import { ServerRuntime } from "next"

// ✨ ایمپورت‌های جدید برای پرداخت و احراز هویت
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { OPENAI_LLM_LIST } from "@/lib/models/llm/openai-llm-list"

export const runtime: ServerRuntime = "edge"

// ✨ ساخت یک Map از قیمت‌ها برای دسترسی سریع و تعریف حاشیه سود
const pricingMap = new Map(
  OPENAI_LLM_LIST.map(llm => [llm.modelId, llm.pricing])
)
const PROFIT_MARGIN = 1.4 // سود ۳۰ درصدی شما

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { message: "A valid text prompt is required." },
        { status: 400 }
      )
    }

    // ۱. احراز هویت کاربر
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
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const userId = user.id

    // ✨ ۲. بهبود کلیدی: بررسی و ساخت خودکار کیف پول در صورت عدم وجود
    let { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()

    if (walletError && walletError.code === "PGRST116") {
      const { data: newWallet, error: createError } = await supabase
        .from("wallets")
        .insert({ user_id: userId, balance: 0 })
        .select("balance")
        .single()
      if (createError) throw createError
      wallet = newWallet
    } else if (walletError) {
      throw walletError
    }

    // ۳. محاسبه هزینه ساخت تصویر
    const dallePriceUSD = pricingMap.get("dall-e-3")?.inputCost || 0.04
    const userCostUSD = dallePriceUSD * PROFIT_MARGIN

    // این خط را جایگزین کنید
    const exchangeRate = 1030000 // قیمت دلخواه خود را اینجا وارد کنید
    const userCostIRR = userCostUSD * exchangeRate

    // ۴. بررسی موجودی کیف پول کاربر
    if (!wallet || wallet.balance < userCostIRR) {
      return new NextResponse(
        JSON.stringify({ message: "موجودی شما برای ساخت تصویر کافی نیست." }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      )
    }

    // ۵. کسر هزینه از حساب کاربر *قبل* از ساخت تصویر
    const { error: rpcError } = await supabase.rpc(
      "deduct_credits_and_log_usage",
      {
        p_user_id: userId,
        p_model_name: "dall-e-3",
        p_prompt_tokens: 0,
        p_completion_tokens: 1, // به معنی ۱ تصویر
        p_cost: userCostIRR
      }
    )

    if (rpcError) {
      console.error("!!! Supabase RPC Error (DALL-E) !!!:", rpcError)
      return NextResponse.json(
        { message: "Failed to process payment." },
        { status: 500 }
      )
    }

    // ۶. ساخت تصویر و مدیریت خطا (با قابلیت بازگشت وجه)
    try {
      const profile = await getServerProfile()
      checkApiKey(profile.openai_api_key, "OpenAI")
      const openai = new OpenAI({
        apiKey: profile.openai_api_key || "",
        organization: profile.openai_organization_id
      })

      return await handleDalleRequest(openai, [
        { role: "user", content: prompt }
      ])
    } catch (generationError: any) {
      console.error(
        "--- DALL-E Generation Failed. Refunding user. ---",
        generationError
      )

      const { error: refundError } = await supabase.rpc("refund_user_credits", {
        p_user_id: userId,
        p_amount: userCostIRR
      })

      if (refundError) {
        console.error("!!! CRITICAL: FAILED TO REFUND USER !!!", refundError)
      }

      return NextResponse.json(
        { message: `Failed to generate image: ${generationError.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("--- CRITICAL ERROR in /api/dalle POST function ---", error)
    const errorMessage = error.message || "An unknown error occurred"
    return NextResponse.json(
      { message: `Failed to process request: ${errorMessage}` },
      { status: 500 }
    )
  }
}
