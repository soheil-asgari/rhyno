import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatAPIPayload } from "@/types"
import OpenAI from "openai"
import { ServerRuntime } from "next"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  try {
    // ۱. احراز هویت
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ message: "Unauthorized: Missing Bearer token" }),
        { status: 401 }
      )
    }
    const token = authHeader.split(" ")[1]

    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ message: "Unauthorized: Invalid token" }),
        { status: 401 }
      )
    }
    const userId = user.id

    // ۲. پروفایل
    const profile = await getServerProfile(userId)
    checkApiKey(profile.azure_openai_api_key, "Azure OpenAI")

    const json = await request.json()
    const { chatSettings, messages } = json as ChatAPIPayload

    const ENDPOINT = profile.azure_openai_endpoint
    const KEY = profile.azure_openai_api_key

    let DEPLOYMENT_ID = ""
    switch (chatSettings.model) {
      case "gpt-3.5-turbo":
        DEPLOYMENT_ID = profile.azure_openai_35_turbo_id || ""
        break
      case "gpt-4-turbo":
        DEPLOYMENT_ID = profile.azure_openai_45_turbo_id || ""
        break
      case "gpt-4-vision-preview":
        DEPLOYMENT_ID = profile.azure_openai_45_vision_id || ""
        break
      default:
        return new Response(JSON.stringify({ message: "Model not found" }), {
          status: 400
        })
    }

    if (!ENDPOINT || !KEY || !DEPLOYMENT_ID) {
      return new Response(
        JSON.stringify({ message: "Azure resources not found" }),
        { status: 400 }
      )
    }

    // ۳. ایجاد Completion با استریم
    const res = await fetch(
      `${ENDPOINT}/openai/deployments/${DEPLOYMENT_ID}/chat/completions?api-version=2023-12-01-preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": KEY
        },
        body: JSON.stringify({
          model: DEPLOYMENT_ID,
          messages,
          temperature: chatSettings.temperature,
          max_tokens:
            chatSettings.model === "gpt-4-vision-preview" ? 4096 : undefined,
          stream: true
        })
      }
    )

    // ۴. برگرداندن استریم مستقیم به کلاینت
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    })
  } catch (error: any) {
    const errorMessage = error.message || "An unexpected error occurred"
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500
    })
  }
}
