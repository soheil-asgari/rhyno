import OpenAI from "openai"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { NextResponse, NextRequest } from "next/server"
import { SupabaseClient, User } from "@supabase/supabase-js"

// تعریف پارامترهای ورودی
// نکته: برای دریافت FormData، باید کل آبجکت request را پاس دهیم
interface HandlerParams {
  request: NextRequest // پاس دادن کل request
  user: User
  supabase: SupabaseClient
}

// ✨ قیمت‌گذاری: هزینه ثابت برای هر دقیقه صدا (مدل whisper-1)
// از آنجایی که طول فایل را نداریم، یک هزینه ثابت برای هر درخواست در نظر می‌گیریم
const STT_REQUEST_COST_USD = 0.01 // مثال: ۱ سنت برای هر درخواست

export async function handleSTT({ request, user, supabase }: HandlerParams) {
  try {
    // =================================================================
    // ✨ بخش ۱: بررسی موجودی کیف پول
    // =================================================================
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single()

    if (!wallet || wallet.balance < STT_REQUEST_COST_USD) {
      return NextResponse.json(
        { message: "موجودی برای تبدیل صدا به متن کافی نیست." },
        { status: 402 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get("file")

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { message: "فایل صوتی آپلود نشده یا نامعتبر است" },
        { status: 400 }
      )
    }

    // =================================================================
    // ✨ بخش ۲: فراخوانی API اصلی
    // =================================================================
    const profile = await getServerProfile()
    const openai = new OpenAI({ apiKey: profile.openai_api_key || "" })

    const response = await openai.audio.transcriptions.create({
      file: audioFile as any, // OpenAI SDK می‌تواند Blob را مدیریت کند
      model: "whisper-1" // استفاده از مدل استاندارد
    })

    // =================================================================
    // ✨ بخش ۳: کسر هزینه در صورت موفقیت
    // =================================================================
    await supabase.rpc("deduct_credits_and_log_usage", {
      p_user_id: user.id,
      p_model_name: "gpt-4o-transcribe", // یا "whisper-1"
      p_prompt_tokens: Math.round(audioFile.size / 1024), // می‌توانیم حجم فایل (KB) را ذخیره کنیم
      p_completion_tokens: 0,
      p_cost: STT_REQUEST_COST_USD
    })

    console.log(
      `✅ هزینه STT به مبلغ ${STT_REQUEST_COST_USD} دلار برای کاربر ${user.id} با موفقیت کسر شد.`
    )

    return NextResponse.json(response)
  } catch (err: any) {
    console.error("❌ خطا در پردازش STT:", err)
    return NextResponse.json(
      { message: err?.message || "خطای ناشناخته در تبدیل صدا به متن" },
      { status: 500 }
    )
  }
}
