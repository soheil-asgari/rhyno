export const runtime = "nodejs"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { modelsWithRial } from "@/app/checkout/pricing"
import { COMPUTER_USE_TOOLS } from "@/lib/agent-tools"

// ✨ ایمپورت‌های جدید برای احراز هویت
import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"

//
// 🛑 === پایان بخش ایمپورت‌ها ===
//

// ... (توابع calculateUserCostUSD و PROFIT_MARGIN) ...
function calculateUserCostUSD(
  modelId: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  // (پیاده‌سازی خودتان را اینجا بگذارید)
  // ... (کد اصلی شما) ...
  // مثال:
  const model = modelsWithRial.find(m => m.id === modelId)
  if (!model) return 0
  const promptCost =
    (usage.prompt_tokens / 1_000_000) * model.inputPricePer1MTokenUSD
  const completionCost =
    (usage.completion_tokens / 1_000_000) * model.outputPricePer1MTokenUSD
  const PROFIT_MARGIN = 1.4 // (این را از کد قبلی کپی کردم)
  return (promptCost + completionCost) * PROFIT_MARGIN
}
// ... (بقیه توابع کمکی شما) ...

//
// 🛑 === شروع تابع POST (کامل و اصلاح شده) ===
//
export async function POST(request: NextRequest) {
  console.log("🔄 درخواست به API Agent Action دریافت شد! 🔄")
  try {
    const { screenshot, user_prompt, history, model_id } = await request.json()

    //
    // 🛑 === شروع بلوک احراز هویت (اصلاح شده) ===
    //

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

    //
    // 🛑 === پایان بلوک احراز هویت ===
    //

    // (چک کردن موجودی کیف پول را اینجا اضافه کنید...)
    // (شما باید منطق چک کردن کیف پول را مانند فایل دیگر، اینجا هم اضافه کنید)
    const cookieStore = cookies() // این را برای کلاینت عمومی لازم داریم
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()

    if (walletError || !wallet || wallet.balance <= 0) {
      return NextResponse.json(
        { message: "موجودی شما برای این عملیات کافی نیست." },
        { status: 402 } // 402 Payment Required
      )
    }

    // ۲. آماده‌سازی OpenRouter
    // 👇✅ *** اصلاحیه اصلی اینجاست ***
    // ما کلاینت ادمین را به getServerProfile پاس می‌دهیم
    const profile = await getServerProfile(userId, supabaseAdmin)
    checkApiKey(profile.openrouter_api_key, "OpenRouter")

    const openrouter = new OpenAI({
      apiKey: profile.openrouter_api_key || "",
      baseURL: "https://openrouter.ai/api/v1"
    })

    // ۳. ساخت پیام‌ها برای مدل (بدون تغییر)
    const messages: any[] = [
      {
        role: "system",
        content:
          "You are an AI agent controlling a browser. You will be given a screenshot and a user prompt. Your goal is to return the next function call (tool call) to achieve the user's goal. Only call one tool at a time. When finished, call 'finish_task'."
      },
      ...history, // (تاریخچه اقدامات قبلی)
      {
        role: "user",
        content: [
          { type: "text", text: `User prompt: ${user_prompt}` },
          {
            type: "image_url",
            image_url: {
              url: screenshot // "data:image/jpeg;base64,..."
            }
          }
        ]
      }
    ]

    // ۴. فراخوانی API (بدون تغییر)
    const response = await openrouter.chat.completions.create({
      model: model_id as any,
      messages: messages,
      tools: COMPUTER_USE_TOOLS,
      tool_choice: "auto",
      stream: false // ❗️ مهم: استریم خاموش است
    })

    const tool_call = response.choices[0].message.tool_calls?.[0]
    const usage = response.usage

    // ۵. محاسبه و کسر هزینه (بدون تغییر)
    if (usage) {
      const userCostUSD = calculateUserCostUSD(model_id, usage)
      console.log(`[Agent] 💰 Cost: ${userCostUSD} USD for user ${userId}`)
      if (userCostUSD > 0) {
        await supabase.rpc("deduct_credits_and_log_usage", {
          p_user_id: userId,
          p_model_name: model_id,
          p_prompt_tokens: usage.prompt_tokens,
          p_completion_tokens: usage.completion_tokens,
          p_cost: userCostUSD
        })
      }
    } else {
      console.warn(`⚠️ [Agent] No usage data received for model: ${model_id}`)
    }

    // ۶. برگرداندن دستور JSON به کلاینت (بدون تغییر)
    if (!tool_call) {
      console.error(
        "No tool call returned by model:",
        response.choices[0].message.content
      )
      return NextResponse.json(
        { error: "Model did not return an action." },
        { status: 500 }
      )
    }

    if (tool_call.type !== "function") {
      console.error("Unknown tool call type received:", tool_call.type)
      return NextResponse.json(
        { error: "Model returned an invalid action type." },
        { status: 500 }
      )
    }

    // ✅ موفقیت! دستور را برگردان
    return NextResponse.json(tool_call.function)
  } catch (error: any) {
    console.error("Agent API Error:", error)
    return new Response(JSON.stringify({ message: error.message }), {
      status: error.status || 500
    })
  }
}
