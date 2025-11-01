import OpenAI from "openai"
import { getServerProfile } from "@/lib/server/server-chat-helpers"
import { NextResponse, NextRequest } from "next/server"
import { SupabaseClient, User } from "@supabase/supabase-js"

import { createClient } from "@supabase/supabase-js"

import jwt from "jsonwebtoken"

interface HandlerParams {
  request: NextRequest
  user: User
  supabase: SupabaseClient
}

const STT_REQUEST_COST_USD = 0.01

export async function handleSTT({ request, user, supabase }: HandlerParams) {
  try {
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
    const profile = await getServerProfile(userId, supabaseAdmin)
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
