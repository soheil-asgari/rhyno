// app/api/chat/handlers/tts.ts
import { SupabaseClient, User } from "@supabase/supabase-js"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { modelsWithRial } from "@/app/checkout/pricing"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js" // (این ایمپورت لازم است، گرچه مستقیماً استفاده نمی‌شود)
import jwt from "jsonwebtoken" // (این ایمپورت لازم است، گرچه مستقیماً استفاده نمی‌شود)

export const runtime = "nodejs"

// ثابت‌ها
const PROFIT_MARGIN = 1.4
const TTS_MODEL_ID = "gpt-4o-mini-tts"

interface HandlerParams {
  request: Request
  body: {
    messages?: { role: string; content: any }[]
    input?: string
    voice?: string
    speed?: number
    chat_id: string // ✅ chat_id برای ذخیره در DB ضروری است
    [key: string]: any
  }
  user: User // (این user از openai/route.ts می‌آید)
  supabase: SupabaseClient // (این همان supabaseAdmin است)
  openaiApiKey?: string
}

// تابع محاسبه هزینه
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

// ==========================================================
//
//                 تابع اصلی handleTTS
//
// ==========================================================

export async function handleTTS({
  request,
  body,
  user,
  supabase // (این حالا کلاینت ادمین است)
}: HandlerParams): Promise<Response> {
  try {
    console.log(`[TTS Handler] 🎤 پردازش درخواست TTS برای کاربر: ${user.id}`)

    const { messages, input, voice, speed, chat_id } = body // ✅ chat_id را بگیرید

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
      console.error(
        "[TTS Handler] ❌ خطای متن: متنی برای تبدیل به صدا یافت نشد"
      )
      return NextResponse.json(
        { message: "متنی برای تبدیل به صدا یافت نشد" },
        { status: 400 }
      )
    }

    // (بلوک احراز هویت دستی حذف شد چون route.ts آن را انجام داده است)
    const supabaseAdmin = supabase

    // محاسبه هزینه
    const characterCount = text.length
    const totalCost = calculateTtsCost(characterCount)
    console.log(
      `[TTS Handler] 📝 تعداد کاراکتر: ${characterCount}, هزینه محاسبه شده: ${totalCost.toFixed(6)} USD`
    )

    // بررسی موجودی کاربر
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single()

    if (!wallet) {
      console.error(
        `[TTS Handler] ❌ خطای کیف پول: کیف پول کاربر ${user.id} یافت نشد.`
      )
      return NextResponse.json(
        { message: "کیف پول کاربر یافت نشد." },
        { status: 404 }
      )
    }

    if (wallet.balance < totalCost) {
      console.warn(
        `[TTS Handler] ⚠️ خطای موجودی: موجودی (${wallet.balance}) برای هزینه (${totalCost}) کافی نیست.`
      )
      return NextResponse.json(
        { message: "موجودی برای انجام عملیات TTS کافی نیست." },
        { status: 402 }
      )
    }

    const profile = await getServerProfile(user.id, supabaseAdmin)

    // درخواست به OpenAI TTS
    console.log(`[TTS Handler] 💬 ارسال درخواست به OpenAI TTS...`)
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

    // ✅✅✅ --- راه‌حل خطای "Body already read" --- ✅✅✅
    // ۱. بدنه (Body) را *فقط یک بار* بخوان
    const audioBuffer = Buffer.from(await response.arrayBuffer())

    // ۲. حالا وضعیت (status) را چک کن
    if (!response.ok) {
      console.error(
        `[TTS Handler] ❌ خطای OpenAI API: Status ${response.status}`
      )
      // اگر خطا بود، تلاش کن بافر را به JSON تبدیل کنی (چون حاوی پیام خطاست)
      try {
        const err = JSON.parse(audioBuffer.toString())
        console.error("[TTS Handler] ❌ پیام خطای OpenAI:", err.error?.message)
        return NextResponse.json(
          { message: err.error?.message || "خطا در ارتباط با OpenAI API" },
          { status: response.status }
        )
      } catch (e) {
        // اگر بافر JSON نبود، فقط متن خطا را برگردان
        console.error(
          "[TTS Handler] ❌ پاسخ خطای OpenAI (غیر JSON):",
          audioBuffer.toString()
        )
        return NextResponse.json(
          { message: audioBuffer.toString() || "خطای ناشناخته OpenAI" },
          { status: response.status }
        )
      }
    }
    // ✅✅✅ --- پایان راه‌حل --- ✅✅✅

    console.log(`[TTS Handler] ✅ پاسخ صوتی از OpenAI دریافت شد.`)

    // کسر هزینه پس از دریافت پاسخ موفق
    if (totalCost > 0) {
      const { error: rpcError } = await supabaseAdmin.rpc(
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
        console.error("⚠️ [TTS Handler] خطا در کسر هزینه از کاربر:", rpcError)
      } else {
        console.log(
          `[TTS Handler] ✅ هزینه TTS (${totalCost.toFixed(6)} USD) از کاربر ${user.id} کسر شد.`
        )
      }
    }

    // ❗️❗️❗️ --- راه‌حل مشکل موبایل (بازگرداندن JSON) --- ❗️❗️❗️

    // ✅ ۳. آپلود در Supabase Storage
    console.log(`[TTS Handler] 📤 آپلود فایل صوتی در Supabase Storage...`)
    const filePath = `tts/${user.id}/${Date.now()}.mp3`
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("audio_files") // ❗️ (مطمئن شوید باکتی به این نام و با پالیسی‌های درست دارید)
      .upload(filePath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false
      })

    if (uploadError) {
      console.error(
        "❌ [TTS Handler] خطای آپلود فایل صوتی در Storage:",
        uploadError
      )
      return NextResponse.json(
        { message: `خطای آپلود فایل: ${uploadError.message}` },
        { status: 500 }
      )
    }
    console.log(`[TTS Handler] ✅ فایل صوتی در '${filePath}' آپلود شد.`)

    // ✅ ۴. گرفتن URL عمومی
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("audio_files")
      .getPublicUrl(filePath)

    const publicAudioUrl = publicUrlData.publicUrl
    console.log(`[TTS Handler] 🔗 URL عمومی فایل: ${publicAudioUrl}`)

    if (!chat_id) {
      console.error(
        "❌ [TTS Handler] chat_id برای ذخیره پیام ارسال نشده بود. پیام در DB ذخیره نشد."
      )
    } else {
      // ✅ ۵. ذخیره پیام در دیتابیس (حل مشکل ذخیره نشدن)
      console.log(
        `[TTS Handler] 💾 ذخیره پیام TTS در دیتابیس برای chat_id: ${chat_id}...`
      )
      await supabaseAdmin.from("messages").insert({
        chat_id: chat_id,
        user_id: user.id,
        content: text,
        role: "assistant",
        model: TTS_MODEL_ID,
        audio_url: publicAudioUrl // ✅✅✅ ذخیره URL
      })

      // (آپدیت timestamp چت)
      await supabaseAdmin
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chat_id)

      console.log(`[TTS Handler] ✅ پیام و timestamp چت در دیتابیس ذخیره شد.`)
    }

    // ✅ ۶. برگرداندن JSON به موبایل (و سایت)
    console.log(`[TTS Handler] ↪️ بازگرداندن پاسخ JSON به کلاینت.`)
    return NextResponse.json({
      text: text, // متنی که به صدا تبدیل شد
      audioUrl: publicAudioUrl // URL فایل صوتی در Storage
    })
    // ❗️❗️❗️ --- پایان راه‌حل --- ❗️❗️❗️
  } catch (error: any) {
    console.error("❌ [TTS Handler] خطای کلی در handleTTS:", error)
    return NextResponse.json(
      { message: "خطا در پردازش درخواست TTS." },
      { status: 500 }
    )
  }
}
