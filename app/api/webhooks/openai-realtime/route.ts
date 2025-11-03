// /app/api/webhooks/openai-realtime/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

// ثابت‌های قیمت مدل‌های Realtime (قیمت بر 1 توکن)
const REALTIME_LLM_PRICING: {
  [key: string]: { input: number; output: number }
} = {
  "gpt-4o-realtime-preview-2025-06-03": {
    input: 40 / 1_000_000,
    output: 80 / 1_000_000
  },
  "gpt-4o-mini-realtime-preview": {
    input: 10 / 1_000_000,
    output: 20 / 1_000_000
  },
  "gpt-realtime": { input: 32 / 1_000_000, output: 64 / 1_000_000 }
}

const PROFIT_MARGIN = 1.6

export async function POST(request: NextRequest) {
  try {
    const event = await request.json()
    console.log("✅ Received Realtime Webhook:", JSON.stringify(event, null, 2))

    const modelId = event.modelId
    const usage = event.usage
    if (!usage)
      return NextResponse.json({ error: "No usage data" }, { status: 400 })

    // دریافت کاربر واقعی از session/JWT
    const cookieStore = cookies()
    const supabase = createSSRClient(cookieStore)

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    const userId = user.id

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()

    if (walletError) throw walletError
    if (!wallet || wallet.balance <= 0)
      return NextResponse.json(
        { message: "موجودی شما کافی نیست." },
        { status: 402 }
      )

    // محاسبه توکن‌ها
    const llmInputTokens =
      (usage.input_token_details.audio_tokens || 0) +
      (usage.input_token_details.text_tokens || 0)
    const llmOutputTokens =
      (usage.output_token_details.audio_tokens || 0) +
      (usage.output_token_details.text_tokens || 0)

    const modelPricing = REALTIME_LLM_PRICING[modelId]
    if (!modelPricing)
      return NextResponse.json({ error: "Unknown model" }, { status: 400 })

    const llmInputCost = llmInputTokens * modelPricing.input
    const llmOutputCost = llmOutputTokens * modelPricing.output
    const totalCost = (llmInputCost + llmOutputCost) * PROFIT_MARGIN

    console.log(`💵 Cost for user ${userId} on model ${modelId}:`, {
      llmInputCost,
      llmOutputCost,
      totalCost,
      totalCostCents: Math.ceil(totalCost * 100)
    })

    // لاگ موجودی قبل
    console.log(`💰 User balance BEFORE deduction: $${wallet.balance}`)

    if (totalCost > 0) {
      await supabase.rpc("deduct_credits_and_log_usage", {
        p_user_id: userId,
        p_model_name: modelId,
        p_prompt_tokens: llmInputTokens,
        p_completion_tokens: llmOutputTokens,
        p_cost: totalCost
      })

      // موجودی بعد از کسر
      const { data: updatedWallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", userId)
        .single()

      console.log(
        `✅ Deducted $${totalCost.toFixed(5)} USD from user ${userId}`
      )
      console.log(`💰 User balance AFTER deduction: $${updatedWallet?.balance}`)
    } else {
      console.log("⚪️ Total cost is zero, no deduction needed.")
    }

    return NextResponse.json({ success: true, totalCost }, { status: 200 })
  } catch (error: any) {
    console.error("❌ Realtime Webhook Error:", error)
    return NextResponse.json(
      { message: error.message || "یک خطای غیرمنتظره رخ داد" },
      { status: 500 }
    )
  }
}
