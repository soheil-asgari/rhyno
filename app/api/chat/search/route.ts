import { getServerProfile, checkApiKey } from "@/lib/server/server-chat-helpers"
import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { ServerRuntime } from "next"
import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"

export const runtime: ServerRuntime = "nodejs"

export async function POST(request: NextRequest) {
  const { query } = await request.json()

  // ============================
  // ۱. احراز هویت کاربر (این بخش اکنون به درستی کار می‌کند)
  // ============================
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new NextResponse(
      JSON.stringify({ error: "Unauthorized: Missing Bearer token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }
  const token = authHeader.split(" ")[1]

  let userId: string
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
      JSON.stringify({
        error: `Unauthorized: Manual verification failed: ${err.message}`
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }

  // ============================
  // ۲. گرفتن پروفایل و بررسی API Key
  // ============================
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on server!")
  }
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ما به این نیاز داریم تا کلید OpenAI کاربر را بگیریم
  const profile = await getServerProfile(userId, supabaseAdmin)
  checkApiKey(profile.openai_api_key, "OpenAI")

  // ============================
  // ۳. فراخوانی OpenAI 4o-mini (همان معماری اصلی شما)
  // ============================
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${profile.openai_api_key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Summarize search results clearly."
        },
        {
          role: "user",
          content: `به فارسی بگو: جست‌وجو کن و نتیجه رو خیلی کوتاه، خلاصه بده: ${query}`
        }
      ],
      tools: [{ type: "web_search" }]
    })
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("❌ OpenAI error:", err)
    return new Response(JSON.stringify({ error: err }), { status: 500 })
  }

  const json = await res.json()
  console.log("🔍 Raw 4o-mini JSON:", json)

  // ============================
  // ۴. استخراج متن از message
  // ============================
  let textResult = "No result found."
  if (Array.isArray(json.output)) {
    const msg = json.output.find((o: any) => o.type === "message")
    if (msg && Array.isArray(msg.content)) {
      textResult = msg.content
        .filter((c: any) => c.type === "output_text" && !!c.text)
        .map((c: any) => c.text)
        .join(" ")
    }
  }

  return new Response(JSON.stringify({ output_text: textResult }), {
    headers: { "Content-Type": "application/json" }
  })
}
