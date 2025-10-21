// app/api/agent/action/route.ts

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { modelsWithRial } from "@/app/checkout/pricing"
import { COMPUTER_USE_TOOLS } from "@/lib/agent-tools" // (فایل ابزارها)

export const runtime = "edge"

// ... (توابع calculateUserCostUSD و PROFIT_MARGIN از کد قبلی شما) ...
function calculateUserCostUSD(
  modelId: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  // ... (منطق محاسبه هزینه شما) ...
  return 0 // (پیاده‌سازی خودتان را اینجا بگذارید)
}

export async function POST(request: NextRequest) {
  console.log("🔄 درخواست به API Agent Action دریافت شد! 🔄")
  try {
    const { screenshot, user_prompt, history, model_id } = await request.json()
    // screenshot: "data:image/jpeg;base64,..."
    // user_prompt: "ایمیل من را چک کن"
    // history: (آرایه‌ای از اقدامات قبلی و نتایج)
    // model_id: "google/gemini-2.5-pro"

    // ۱. احراز هویت و پرداخت (مشابه کد شما)
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse("Unauthorized", { status: 401 })
    const userId = user.id

    // (چک کردن موجودی کیف پول را اینجا اضافه کنید...)

    // ۲. آماده‌سازی OpenRouter
    const profile = await getServerProfile()
    checkApiKey(profile.openrouter_api_key, "OpenRouter")

    const openrouter = new OpenAI({
      apiKey: profile.openrouter_api_key || "",
      baseURL: "https://openrouter.ai/api/v1"
    })

    // ۳. ساخت پیام‌ها برای مدل
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

    // ۴. فراخوانی API (بدون استریم)
    const response = await openrouter.chat.completions.create({
      model: model_id as any,
      messages: messages,
      tools: COMPUTER_USE_TOOLS,
      tool_choice: "auto",
      stream: false // ❗️ مهم: استریم خاموش است
    })

    const tool_call = response.choices[0].message.tool_calls?.[0]
    const usage = response.usage

    // ۵. محاسبه و کسر هزینه (مشابه کد شما)
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

    // ۶. برگرداندن دستور JSON به کلاینت
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
  } catch (error: any) {
    console.error("Agent API Error:", error)
    return new Response(JSON.stringify({ message: error.message }), {
      status: error.status || 500
    })
  }
}
