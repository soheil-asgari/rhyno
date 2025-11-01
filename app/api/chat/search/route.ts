import { getServerProfile, checkApiKey } from "@/lib/server/server-chat-helpers"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  const { query } = await req.json()

  // ============================
  // ۱. احراز هویت کاربر
  // ============================
  const authHeader = req.headers.get("Authorization")
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

  // ============================
  // ۲. گرفتن پروفایل و بررسی API Key
  // ============================
  const profile = await getServerProfile(userId)
  checkApiKey(profile.openai_api_key, "OpenAI")

  // ============================
  // ۳. فراخوانی OpenAI 4o-mini
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
