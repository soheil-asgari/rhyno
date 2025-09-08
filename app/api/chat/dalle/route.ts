import { NextResponse } from "next/server"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"
import { handleDalleRequest } from "@/lib/dalle-handler"
import { ServerRuntime } from "next"
// ✨ ایمپورت‌های جدید برای پرداخت و احراز هویت
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { OPENAI_LLM_LIST } from "@/lib/models/llm/openai-llm-list"

export const runtime = "edge"

const pricingMap = new Map(
  OPENAI_LLM_LIST.map(llm => [llm.modelId, llm.pricing])
)
const PROFIT_MARGIN = 1.4 // 40% سود

export async function POST(request: Request) {
  console.log("🎨 درخواست ساخت تصویر به API DALL-E دریافت شد! 🎨")
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== "string") {
      console.log("--- X. ERROR: Prompt is invalid. Returning 400. ---") // لاگ خطا
      return NextResponse.json(
        { message: "A valid text prompt is required for DALL-E 3." },
        { status: 400 }
      )
    }

    // ✨ ۱. احراز هویت و بررسی کیف پول کاربر
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

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()

    if (walletError && walletError.code === "PGRST116") {
      return NextResponse.json(
        { message: "موجودی شما کافی نیست." },
        { status: 402 }
      )
    } else if (walletError) {
      throw walletError
    }
    if (!wallet) return new NextResponse("Wallet not found", { status: 404 })

    // ✨ ۲. محاسبه هزینه ساخت تصویر به دلار
    const dallePriceUSD = pricingMap.get("dall-e-3")?.inputCost || 0.04
    const userCostUSD = dallePriceUSD * PROFIT_MARGIN

    // ✨ ۳. بررسی موجودی دلاری کاربر
    if (wallet.balance < userCostUSD) {
      return NextResponse.json(
        { message: "موجودی شما برای ساخت تصویر کافی نیست." },
        { status: 402 }
      )
    }

    console.log("💰 موجودی قبل از کسر:", wallet.balance, "USD")

    const { error: rpcError } = await supabase.rpc(
      "deduct_credits_and_log_usage",
      {
        p_user_id: userId,
        p_model_name: "dall-e-3",
        p_prompt_tokens: 0,
        p_completion_tokens: 1,
        p_cost: userCostUSD
      }
    )

    if (rpcError) {
      console.error("❌ خطا در کسر هزینه:", rpcError)
    } else {
      // گرفتن موجودی جدید برای تایید
      const { data: updatedWallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single()

      console.log("💵 موجودی بعد از کسر:", updatedWallet?.balance, "USD")
    }

    // ✨ ۵. ساخت تصویر و مدیریت خطا (با قابلیت بازگشت وجه)
    try {
      const profile = await getServerProfile()
      checkApiKey(profile.openai_api_key, "OpenAI")
      const openai = new OpenAI({
        apiKey: profile.openai_api_key || "",
        organization: profile.openai_organization_id
      })

      // اگر ساخت تصویر موفقیت‌آمیز باشد، پاسخ به کاربر ارسال می‌شود
      return await handleDalleRequest(openai, [
        { role: "user", content: prompt }
      ])
    } catch (generationError: any) {
      // اگر ساخت تصویر با خطا مواجه شد، هزینه را به کاربر برگردان
      console.error(
        "--- DALL-E Generation Failed. Refunding user. ---",
        generationError
      )

      await supabase.rpc("refund_user_credits", {
        p_user_id: userId,
        p_amount_usd: userCostUSD
      })

      // خطای اصلی را به فرانت‌اند برگردان
      throw generationError
    }
  } catch (error: any) {
    console.error("--- CRITICAL ERROR in /api/dalle POST function ---", error)
    const errorMessage = error.message || "An unknown error occurred"
    return NextResponse.json(
      { message: `Failed to generate image: ${errorMessage}` },
      { status: 500 }
    )
  }
}
