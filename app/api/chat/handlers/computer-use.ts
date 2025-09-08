import OpenAI from "openai"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { NextResponse } from "next/server"
import { SupabaseClient, User } from "@supabase/supabase-js"

// تعریف پارامترهای ورودی
interface HandlerParams {
  body: any
  user: User
  supabase: SupabaseClient
}

export interface ComputerUseInput {
  inputText: string
  displayWidth?: number
  displayHeight?: number
  environment?: "browser" | "mac" | "windows" | "ubuntu"
}

// ✨ قیمت‌گذاری: هزینه ثابت برای هر درخواست Computer-Use
const COMPUTER_USE_COST_USD = 0.02 // مثال: ۲ سنت برای هر درخواست

export async function handleComputerUse({
  body,
  user,
  supabase
}: HandlerParams) {
  const data: ComputerUseInput = body

  try {
    if (!data.inputText) {
      return NextResponse.json(
        { message: "متن ورودی کاربر مشخص نشده است" },
        { status: 400 }
      )
    }

    // =================================================================
    // ✨ بخش ۱: بررسی موجودی کیف پول
    // =================================================================
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single()

    if (!wallet || wallet.balance < COMPUTER_USE_COST_USD) {
      return NextResponse.json(
        { message: "موجودی برای این عملیات کافی نیست." },
        { status: 402 }
      )
    }

    // =================================================================
    // ✨ بخش ۲: فراخوانی API اصلی
    // =================================================================
    const profile = await getServerProfile()
    const openai = new OpenAI({ apiKey: profile.openai_api_key || "" })

    const response = await openai.responses.create({
      model: "computer-use-preview",
      tools: [
        {
          type: "computer_use_preview",
          display_width: data.displayWidth || 1024,
          display_height: data.displayHeight || 768,
          environment: data.environment || "browser"
        }
      ],
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: data.inputText
            }
          ]
        }
      ]
    })

    // این مدل معمولاً usage برنمی‌گرداند، پس از هزینه ثابت استفاده می‌کنیم

    // =================================================================
    // ✨ بخش ۳: کسر هزینه در صورت موفقیت
    // =================================================================
    await supabase.rpc("deduct_credits_and_log_usage", {
      p_user_id: user.id,
      p_model_name: "computer-use-preview",
      p_prompt_tokens: data.inputText.length,
      p_completion_tokens: 0,
      p_cost: COMPUTER_USE_COST_USD
    })

    console.log(
      `✅ هزینه Computer-Use به مبلغ ${COMPUTER_USE_COST_USD} دلار برای کاربر ${user.id} با موفقیت کسر شد.`
    )

    return NextResponse.json(response.output)
  } catch (err: any) {
    console.error("❌ ComputerUse error:", err)
    return NextResponse.json(
      {
        message: err?.message || "خطای ناشناخته در اجرای computer-use-preview"
      },
      { status: 500 }
    )
  }
}
