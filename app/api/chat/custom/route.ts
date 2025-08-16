import { Database } from "@/supabase/types"
import { ChatSettings } from "@/types"
import { createClient } from "@supabase/supabase-js"
import { createOpenAI } from "@ai-sdk/openai"

import { NextRequest } from "next/server"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  const json = await request.json()
  const { chatSettings, messages, customModelId } = json as {
    chatSettings: ChatSettings
    messages: any[]
    customModelId: string
  }

  try {
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: customModel, error } = await supabaseAdmin
      .from("models")
      .select("*")
      .eq("id", customModelId)
      .single()

    if (!customModel) {
      throw new Error(error?.message || "Custom model not found")
    }

    // ایجاد کلاینت OpenAI سفارشی با Vercel AI SDK
    const custom = createOpenAI({
      apiKey: customModel.api_key || "",
      baseURL: customModel.base_url
    })

    // استریم پاسخ با Vercel AI SDK
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "Custom API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("incorrect api key")) {
      errorMessage =
        "Custom API Key is incorrect. Please fix it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode,
      headers: { "Content-Type": "application/json" }
    })
  }
}
