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
import { encode } from "gpt-tokenizer" // ⬅️ 1. این ایمپورت حیاتی را اضافه کنید

export const runtime: ServerRuntime = "nodejs"
export const maxDuration = 240

// ✨ ثابت‌ها و تابع محاسبه هزینه (مشابه کدهای دیگر)
const PROFIT_MARGIN = 1.0

type ChatCompletionUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

// ⬅️ 2. مدل‌هایی که از وب سرچ OpenRouter استفاده می‌کنند
const MODELS_WITH_WEB_SEARCH = new Set([
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-codex",
  "google/gemini-1.5-flash" // (مثال - مدل خودتان را اضافه کنید)
])

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
    // ⬅️ 3. دریافت `enableWebSearch` از بدنه درخواست
    const { chatSettings, messages, enableWebSearch } =
      (await request.json()) as {
        chatSettings: ChatSettings
        messages: any[]
        enableWebSearch?: boolean // این را اضافه کنید
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

    const { data: wallet, error: walletError } = await supabaseAdmin // ⬅️ از Admin استفاده کنید
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
    const isImageModel = modelsWithImageOutput.includes(model)

    // ⬅️ 4. محاسبه توکن‌های پرامپت *قبل* از استریم (برای محاسبه هزینه)
    let calculated_prompt_tokens = 0
    try {
      for (const message of messages) {
        if (typeof message.content === "string") {
          // اگر پیام فقط متن است
          calculated_prompt_tokens += encode(message.content).length
        } else if (Array.isArray(message.content)) {
          // اگر پیام شامل متن و عکس است (آرایه)
          for (const part of message.content) {
            if (part.type === "text") {
              calculated_prompt_tokens += encode(part.text || "").length
            } else if (part.type === "image_url") {
              // ✅ نکته مهم: به جای شمردن کد عکس، هزینه تقریبی (مثلا ۱۰۰۰ توکن) را اضافه می‌کنیم
              calculated_prompt_tokens += 1000
            }
          }
        }
      }
      console.log(
        `[OpenRouter] 📊 Calculated Prompt Tokens: ${calculated_prompt_tokens}`
      )
    } catch (e: any) {
      console.error(
        "[OpenRouter] ❌ Error calculating prompt tokens:",
        e.message
      )
    }

    // ⬅️ 5. ساخت داینامیک بدنه درخواست
    const requestPayload: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming =
      {
        model: model as any,
        messages: messages as any,
        stream: true
      }

    // ⬅️ 6. اضافه کردن ابزار وب سرچ در صورت نیاز
    const doWebSearch = !!enableWebSearch && MODELS_WITH_WEB_SEARCH.has(model)
    if (doWebSearch) {
      console.log(`[OpenRouter] 🔎 Enabling Web Search for model: ${model}`)
      // @ts-ignore - OpenRouter این را می‌پذیرد
      requestPayload.tools = [{ type: "web_search" }]
    }

    // ۳. پارامتر 'modalities' را فقط در صورت نیاز اضافه کنید
    if (isImageModel) {
      // @ts-ignore - چون modalities در تایپ استاندارد OpenAI نیست
      requestPayload.modalities = ["image", "text"]
    }

    // ۴. درخواست را با بدنه داینامیک ارسال کنید
    const responseStream =
      await openrouter.chat.completions.create(requestPayload)

    const encoder = new TextEncoder()

    // ⬅️ 7. بازنویسی کامل منطق ReadableStream
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullText = ""
        let imageBase64 = ""
        // ✨ متغیری برای ذخیره اطلاعات مصرف (اگر API ارسال کرد)
        let usage: ChatCompletionUsage | undefined

        try {
          for await (const chunk of responseStream) {
            // دریافت متن
            const textDelta = chunk.choices[0]?.delta?.content || ""
            if (textDelta) {
              fullText += textDelta
              // --- ⚡️ این بخش حیاتی است ⚡️ ---
              // اگر مدل تصویری نیست، متن را *فورا* ارسال کن
              if (!isImageModel) {
                controller.enqueue(encoder.encode(textDelta))
              }
              // ---------------------------------
            }

            // دریافت تصویر (فقط برای مدل تصویری)
            if (isImageModel) {
              const imageDelta = (chunk.choices[0]?.delta as any)?.images
              if (imageDelta && imageDelta.length > 0) {
                const imageUrl = imageDelta[0]?.image_url?.url
                if (imageUrl && imageUrl.startsWith("data:image")) {
                  imageBase64 += imageUrl.split(",")[1] || ""
                }
              }
            }

            // ✨ دریافت اطلاعات مصرف از آخرین chunk (اگر OpenRouter بفرستد)
            if (chunk.usage) {
              usage = chunk.usage
            }
          }

          // اگر مدل تصویری بود، پاسخ بافر شده را *در انتها* ارسال کن
          if (isImageModel) {
            const finalResponse = `${fullText}%%RHINO_IMAGE_SEPARATOR%%${imageBase64}`
            controller.enqueue(encoder.encode(finalResponse))
          }
        } catch (error) {
          console.error("[OpenRouter] Error during stream processing:", error)
          controller.error(error)
        } finally {
          controller.close() // بستن استریم به سمت کلاینت

          // --- 8. منطق محاسبه هزینه در بلاک finally ---
          let finalUsage: ChatCompletionUsage

          if (usage) {
            // حالت ایده‌آل: OpenRouter اطلاعات مصرف را فرستاده
            console.log("[OpenRouter] 📊 Usage data received from stream.")
            finalUsage = usage
          } else {
            // حالت Fallback: ما خودمان توکن‌ها را محاسبه می‌کنیم
            console.warn(
              `[OpenRouter] ⚠️ No usage data from stream. Calculating manually.`
            )
            let calculated_completion_tokens = 0
            try {
              if (fullText.trim().length > 0) {
                calculated_completion_tokens = encode(fullText.trim()).length
              }
            } catch (e: any) {
              console.error(
                "[OpenRouter] ❌ Error calculating completion tokens:",
                e.message
              )
            }

            finalUsage = {
              prompt_tokens: calculated_prompt_tokens,
              completion_tokens: calculated_completion_tokens,
              total_tokens:
                calculated_prompt_tokens + calculated_completion_tokens
            }
          }

          // کسر هزینه نهایی
          if (
            finalUsage.prompt_tokens > 0 ||
            finalUsage.completion_tokens > 0
          ) {
            const modelId = chatSettings.model
            const userCostUSD = calculateUserCostUSD(modelId, finalUsage)

            console.log(`[OpenRouter] 📊 Final Usage:`, finalUsage)
            console.log(
              `[OpenRouter] 💰 Cost: ${userCostUSD} USD for user ${userId}`
            )

            if (userCostUSD > 0 && wallet.balance > userCostUSD) {
              await supabaseAdmin.rpc("deduct_credits_and_log_usage", {
                // ⬅️ از Admin استفاده کنید
                p_user_id: userId,
                p_model_name: modelId,
                p_prompt_tokens: finalUsage.prompt_tokens,
                p_completion_tokens: finalUsage.completion_tokens,
                p_cost: userCostUSD
              })
              console.log(
                `[OpenRouter] ✅ Credits deducted successfully for user ${userId}.`
              )
            } else if (userCostUSD > 0) {
              console.error(
                `[OpenRouter] ❌ Failed to deduct. Cost: ${userCostUSD}, Balance: ${wallet.balance}`
              )
            }
          } else {
            console.log("[OpenRouter] ⚠️ Usage was zero. Skipping deduction.")
          }
        }
      }
    })

    // ⬅️ 9. هدرهای ضروری برای استریم
    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no"
      }
    })
  } catch (error: any) {
    console.error("OpenRouter API Error:", error)
    const errorMessage = error.message || "An unknown error occurred"
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: error.status || 500
    })
  }
}
