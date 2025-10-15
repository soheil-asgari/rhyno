import { NextResponse } from "next/server"
import { SupabaseClient, User } from "@supabase/supabase-js"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { modelsWithRial } from "@/app/checkout/pricing"

// ثابت‌ها
const PROFIT_MARGIN = 1.4
const TTS_MODEL_ID = "gpt-4o-mini-tts"

interface HandlerParams {
  body: {
    messages?: { role: string; content: any }[]
    input?: string
    voice?: string
    [key: string]: any
    speed?: number
  }
  user: User
  supabase: SupabaseClient
}

// محاسبه هزینه
export function calculateTtsCost(
  characterCount: number,
  inRial = false
): number {
  if (characterCount === 0) return 0

  // گرفتن مدل TTS از لیست مدل‌ها
  const model = modelsWithRial.find(m => m.id === TTS_MODEL_ID)
  if (!model) return 0

  // محاسبه پایه هزینه بر اساس تعداد کاراکتر
  const baseCostUSD =
    (characterCount / 1_000_000) * model.inputPricePer1MTokenUSD

  // اعمال مارجین
  const finalCostUSD = baseCostUSD * PROFIT_MARGIN

  return inRial ? Math.round(finalCostUSD * 10300) : finalCostUSD
}
export async function handleTTS({
  body,
  user,
  supabase
}: HandlerParams): Promise<Response> {
  try {
    // console.log(`🎤 پردازش درخواست TTS برای کاربر: ${user.id}`)

    const { messages, input, voice, speed } = body

    // دریافت متن از messages یا input
    let text: string | undefined
    if (messages && Array.isArray(messages)) {
      const lastUserMessage = messages.filter(m => m.role === "user").pop()
      text = lastUserMessage?.content
    }
    if (!text && typeof input === "string") {
      text = input
    }

    if (!text || text.length === 0) {
      return NextResponse.json(
        { message: "متنی برای تبدیل به صدا یافت نشد" },
        { status: 400 }
      )
    }

    // محاسبه هزینه
    const characterCount = text.length
    const totalCost = calculateTtsCost(characterCount)
    // console.log(
    //   `📝 تعداد کاراکتر: ${characterCount}, هزینه محاسبه شده: ${totalCost.toFixed(6)} USD`
    // )

    // بررسی موجودی کاربر
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single()

    if (!wallet) {
      return NextResponse.json(
        { message: "کیف پول کاربر یافت نشد." },
        { status: 404 }
      )
    }

    if (wallet.balance < totalCost) {
      return NextResponse.json(
        { message: "موجودی برای انجام عملیات TTS کافی نیست." },
        { status: 402 }
      )
    }

    const profile = await getServerProfile()

    // درخواست به OpenAI TTS
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${profile.openai_api_key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: TTS_MODEL_ID,
        voice: voice || "alloy",
        speed: speed || 1.0,
        input: text
      })
    })

    if (!response.ok) {
      const err = await response.json()
      return NextResponse.json(
        { message: err.error?.message || "خطا در ارتباط با OpenAI API" },
        { status: response.status }
      )
    }

    // کسر هزینه پس از دریافت پاسخ موفق
    if (totalCost > 0) {
      const { error: rpcError } = await supabase.rpc(
        "deduct_credits_and_log_usage",
        {
          p_user_id: user.id,
          p_model_name: TTS_MODEL_ID,
          p_prompt_tokens: characterCount,
          p_completion_tokens: 0,
          p_cost: totalCost
        }
      )
      if (rpcError) {
        console.error("⚠️ خطا در کسر هزینه از کاربر:", rpcError)
      } else {
        // console.log(
        //   `✅ هزینه TTS (${totalCost.toFixed(6)} USD) از کاربر ${user.id} کسر شد.`
        // )
      }
    }

    // بازگرداندن فایل صوتی
    const audioData = await response.arrayBuffer()
    return new Response(Buffer.from(audioData), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" }
    })
  } catch (error: any) {
    console.error("❌ خطای کلی در handleTTS:", error)
    return NextResponse.json(
      { message: "خطا در پردازش درخواست TTS." },
      { status: 500 }
    )
  }
}
