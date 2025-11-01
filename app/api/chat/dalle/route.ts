import { NextResponse } from "next/server"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"
import { handleDalleRequest } from "@/lib/dalle-handler"
import { ServerRuntime } from "next"

// ✨ ایمپورت‌های جدید برای پرداخت و احراز هویت
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
// ✨ ایمپورت متمرکز قیمت‌گذاری
import { modelsWithRial } from "@/app/checkout/pricing"

export const runtime = "edge"

// ✨ ثابت‌ها و تابع محاسبه هزینه (مشابه کد دوم شما)
const PROFIT_MARGIN = 1.4

/**
 * Calculates the cost for the user in USD based on the model and usage.
 * This function is now generalized to be used across different APIs.
 * @param modelId The ID of the model used (e.g., "dall-e-3").
 * @param usage An object containing prompt and completion tokens. For DALL-E,
 * we simulate this with prompt_tokens: 0 and completion_tokens: 1.
 * @returns The calculated cost in USD for the user.
 */
function calculateUserCostUSD(
  modelId: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  // پیدا کردن مدل از منبع قیمت‌گذاری متمرکز
  const model = modelsWithRial.find(m => m.id === modelId)
  if (!model) {
    console.error(`Pricing info for model "${modelId}" not found.`)
    return 0
  }

  // برای DALL-E، هزینه ورودی صفر است و هزینه خروجی بر اساس قیمت هر تصویر محاسبه می‌شود.
  // فرض می‌کنیم در modelsWithRial قیمت DALL-E به عنوان outputPricePer1MTokenUSD ذخیره شده.
  const promptCost =
    (usage.prompt_tokens / 1_000_000) * model.inputPricePer1MTokenUSD
  const completionCost =
    (usage.completion_tokens / 1_000_000) * model.outputPricePer1MTokenUSD

  return (promptCost + completionCost) * PROFIT_MARGIN
}

export async function POST(request: Request) {
  // console.log("🎨 درخواست ساخت تصویر به API DALL-E دریافت شد! 🎨")
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== "string") {
      // console.log("--- X. ERROR: Prompt is invalid. Returning 400. ---")
      return NextResponse.json(
        { message: "A valid text prompt is required for DALL-E 3." },
        { status: 400 }
      )
    }

    // ۱. احراز هویت و بررسی کیف پول کاربر (بدون تغییر)
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

    // ✨ ۲. محاسبه هزینه ساخت تصویر با استفاده از تابع جدید
    const modelId = "dall-e-3"
    // شبیه‌سازی مصرف: هر تصویر معادل 1 توکن خروجی است
    const usage = { prompt_tokens: 0, completion_tokens: 1 }
    const userCostUSD = calculateUserCostUSD(modelId, usage)

    if (userCostUSD === 0) {
      console.error(
        "Could not calculate cost. Check pricing info for DALL-E 3."
      )
      return NextResponse.json(
        { message: "خطا در محاسبه هزینه" },
        { status: 500 }
      )
    }

    // ۳. بررسی موجودی دلاری کاربر (بدون تغییر)
    if (wallet.balance < userCostUSD) {
      return NextResponse.json(
        { message: "موجودی شما برای ساخت تصویر کافی نیست." },
        { status: 402 }
      )
    }

    // ۴. کسر هزینه از کیف پول کاربر (منطق RPC بدون تغییر باقی می‌ماند)
    // console.log("💰 موجودی قبل از کسر:", wallet.balance, "USD")
    const { error: rpcError } = await supabase.rpc(
      "deduct_credits_and_log_usage",
      {
        p_user_id: userId,
        p_model_name: modelId,
        p_prompt_tokens: usage.prompt_tokens, // 0
        p_completion_tokens: usage.completion_tokens, // 1
        p_cost: userCostUSD
      }
    )

    if (rpcError) {
      console.error("❌ خطا در کسر هزینه:", rpcError)
      // اگر کسر هزینه با خطا مواجه شد، بهتر است عملیات متوقف شود
      return NextResponse.json(
        { message: "خطا در پردازش پرداخت." },
        { status: 500 }
      )
    }

    // تایید کسر هزینه (اختیاری ولی خوب است)
    const { data: updatedWallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()
    // console.log("💵 موجودی بعد از کسر:", updatedWallet?.balance, "USD")

    // ۵. ساخت تصویر و مدیریت خطا با قابلیت بازگشت وجه (بدون تغییر)
    try {
      const profile = await getServerProfile(userId)
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

      // بازگرداندن هزینه در صورت شکست در ساخت تصویر
      await supabase.rpc("refund_user_credits", {
        p_user_id: userId,
        p_amount_usd: userCostUSD
      })

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
