import { SupabaseClient, User } from "@supabase/supabase-js"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { modelsWithRial } from "@/app/checkout/pricing"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@supabase/supabase-js"

import jwt from "jsonwebtoken"
export const runtime = "nodejs"

// ثابت‌ها
const PROFIT_MARGIN = 1.4
const TTS_MODEL_ID = "gpt-4o-mini-tts"

interface HandlerParams {
  request: Request // 👈 اضافه کن
  body: {
    messages?: { role: string; content: any }[]
    input?: string
    voice?: string
    speed?: number
    [key: string]: any
  }
  user: User
  supabase: SupabaseClient
  openaiApiKey?: string
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
  request,
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
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized: Missing Bearer token", {
        status: 401
      })
    }
    const token = authHeader.split(" ")[1]

    let userId: string

    // ۱. اعتبارسنجی دستی توکن با JWT_SECRET
    try {
      if (!process.env.SUPABASE_JWT_SECRET) {
        throw new Error("SUPABASE_JWT_SECRET is not set on server!")
      }
      const decodedToken = jwt.verify(
        token,
        process.env.SUPABASE_JWT_SECRET
      ) as jwt.JwtPayload

      if (!decodedToken.sub) {
        throw new Error("Invalid token: No 'sub' (user ID) found.")
      }
      userId = decodedToken.sub // 'sub' همان User ID است
      console.log(`[Agent] ✅ Token MANUALLY verified! User ID: ${userId}`)
    } catch (err: any) {
      console.error("[Agent] ❌ Manual JWT Verification Failed:", err.message)
      return new NextResponse(
        `Unauthorized: Manual verification failed: ${err.message}`,
        { status: 401 }
      )
    }

    // ۲. ساخت کلاینت ادمین (Admin) برای گرفتن آبجکت کامل User
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on server!")
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const {
      data: { user },
      error: adminError
    } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (adminError || !user) {
      console.error(
        "[Agent] ❌ Admin client failed to get user:",
        adminError?.message
      )
      return new NextResponse(
        `Unauthorized: User not found with admin client: ${adminError?.message}`,
        { status: 401 }
      )
    }
    console.log(`[Agent] ✅ Full user object retrieved for: ${user.email}`)
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

    const profile = await getServerProfile(userId, supabaseAdmin)

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
