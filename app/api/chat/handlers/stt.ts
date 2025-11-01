import OpenAI from "openai"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { NextResponse, NextRequest } from "next/server"
import { SupabaseClient, User } from "@supabase/supabase-js"

interface HandlerParams {
  request: NextRequest
  user: User
  supabase: SupabaseClient
}

const STT_REQUEST_COST_USD = 0.01

export async function handleSTT({ request, user, supabase }: HandlerParams) {
  try {
    // بررسی موجودی کیف پول
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

    // گرفتن پروفایل کاربر
    const profile = await getServerProfile(user.id)
    if (!profile.openai_api_key) {
      return NextResponse.json(
        { message: "OpenAI API Key پیدا نشد." },
        { status: 401 }
      )
    }

    const openai = new OpenAI({ apiKey: profile.openai_api_key })

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile as any, // OpenAI SDK با Blob سازگار است
      model: "whisper-1"
    })

    // کسر هزینه از کیف پول
    await supabase.rpc("deduct_credits_and_log_usage", {
      p_user_id: user.id,
      p_model_name: "whisper-1",
      p_prompt_tokens: Math.ceil(audioFile.size / 1024), // تقریب حجم فایل به KB
      p_completion_tokens: 0,
      p_cost: STT_REQUEST_COST_USD
    })

    return NextResponse.json(transcription)
  } catch (err: any) {
    console.error("❌ خطا در پردازش STT:", err)
    return NextResponse.json(
      { message: err?.message || "خطای ناشناخته در تبدیل صدا به متن" },
      { status: 500 }
    )
  }
}
