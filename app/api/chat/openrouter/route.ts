// app/api/chat/openrouter/route.ts

import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"

// ✨ ایمپورت‌های جدید برای پرداخت و احراز هویت
import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { modelsWithRial } from "@/app/checkout/pricing"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@supabase/supabase-js"

import jwt from "jsonwebtoken"

export const runtime: ServerRuntime = "nodejs"

// ✨ ثابت‌ها و تابع محاسبه هزینه (مشابه کدهای دیگر)
const PROFIT_MARGIN = 1.0

type ChatCompletionUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

function calculateUserCostUSD(
  modelId: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  const model = modelsWithRial.find(m => m.id === modelId)
  if (!model) {
    console.error(`Pricing info for model "${modelId}" not found.`)
    return 0
  }

  const promptCost =
    (usage.prompt_tokens / 1_000_000) * model.inputPricePer1MTokenUSD
  const completionCost =
    (usage.completion_tokens / 1_000_000) * model.outputPricePer1MTokenUSD

  return (promptCost + completionCost) * PROFIT_MARGIN
}

export async function POST(request: Request) {
  console.log("🔄 درخواست به API OpenRouter دریافت شد! 🔄")
  try {
    const { chatSettings, messages } = (await request.json()) as {
      chatSettings: ChatSettings
      messages: any[]
    }
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
    // ✨ ۱. شروع بخش پرداخت و احراز هویت
    const cookieStore = cookies()
    const supabase = createSSRClient(cookieStore)

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()

    if (walletError) throw walletError
    if (!wallet || wallet.balance <= 0) {
      return NextResponse.json(
        { message: "موجودی شما کافی نیست." },
        { status: 402 }
      )
    }
    // ✨ پایان بخش پرداخت و احراز هویت

    const profile = await getServerProfile(userId, supabaseAdmin)
    checkApiKey(profile.openrouter_api_key, "OpenRouter")

    const openrouter = new OpenAI({
      apiKey: profile.openrouter_api_key || "",
      baseURL: "https://openrouter.ai/api/v1"
    })

    const modelsWithImageOutput = [
      "google/gemini-2.5-flash-image"
      // ... هر مدل دیگری که خروجی تصویر می‌دهد
    ]

    const model = chatSettings.model

    // ۲. بدنه درخواست را به صورت داینامیک بسازید
    const requestPayload: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
      {
        model: model as any,
        messages: messages as any,
        stream: true
      }

    // ۳. پارامتر 'modalities' را فقط در صورت نیاز اضافه کنید
    if (modelsWithImageOutput.includes(model)) {
      // @ts-ignore - چون modalities در تایپ استاندارد OpenAI نیست
      requestPayload.modalities = ["image", "text"]
    }

    // ۴. درخواست را با بدنه داینامیک ارسال کنید
    const responseStream =
      await openrouter.chat.completions.create(requestPayload)

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullText = ""
        let imageBase64 = ""
        // ✨ متغیری برای ذخیره اطلاعات مصرف
        let usage: ChatCompletionUsage | undefined

        try {
          for await (const chunk of responseStream) {
            // دریافت متن
            const textDelta = chunk.choices[0]?.delta?.content || ""
            if (textDelta) {
              fullText += textDelta
            }

            // دریافت تصویر
            const imageDelta = (chunk.choices[0]?.delta as any)?.images
            if (imageDelta && imageDelta.length > 0) {
              const imageUrl = imageDelta[0]?.image_url?.url
              if (imageUrl && imageUrl.startsWith("data:image")) {
                imageBase64 += imageUrl.split(",")[1] || ""
              }
            }

            // ✨ دریافت اطلاعات مصرف از آخرین chunk
            if (chunk.usage) {
              usage = chunk.usage
            }
          }

          // ترکیب پاسخ نهایی برای ارسال به کلاینت
          const finalResponse = `${fullText}%%RHINO_IMAGE_SEPARATOR%%${imageBase64}`
          controller.enqueue(encoder.encode(finalResponse))

          // ✨ ۲. محاسبه و کسر هزینه پس از اتمام استریم
          if (usage) {
            const modelId = chatSettings.model
            const userCostUSD = calculateUserCostUSD(modelId, usage)

            console.log(`[OpenRouter] 📊 Usage:`, usage)
            console.log(
              `[OpenRouter] 💰 Cost: ${userCostUSD} USD for user ${userId}`
            )

            if (userCostUSD > 0) {
              await supabase.rpc("deduct_credits_and_log_usage", {
                p_user_id: userId,
                p_model_name: modelId,
                p_prompt_tokens: usage.prompt_tokens,
                p_completion_tokens: usage.completion_tokens,
                p_cost: userCostUSD
              })
              console.log(
                `[OpenRouter] ✅ Credits deducted successfully for user ${userId}.`
              )
            }
          } else {
            console.warn(
              `⚠️ [OpenRouter] No usage data received from stream for model: ${chatSettings.model}`
            )
          }
        } catch (error) {
          console.error("[OpenRouter] Error during stream processing:", error)
          controller.error(error)
        } finally {
          controller.close()
        }
      }
    })

    return new Response(readableStream)
  } catch (error: any) {
    console.error("OpenRouter API Error:", error)
    const errorMessage = error.message || "An unknown error occurred"
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: error.status || 500
    })
  }
}
