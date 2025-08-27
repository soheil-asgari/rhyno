import { getServerProfile, checkApiKey } from "@/lib/server/server-chat-helpers"

export async function POST(req: Request) {
  const { query } = await req.json()

  const profile = await getServerProfile()
  checkApiKey(profile.openai_api_key, "OpenAI")

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
          content: `به فارسی بگو: جست‌وجو کن و نتیجه رو  خیلی کوتاه، خلاصه بده: ${query}`
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

  // 🟢 استخراج متن از message
  const msg = json.output.find((o: any) => o.type === "message")

  // مطمئن شو content آرایه‌ست و text داره
  let textResult = "No result found."
  if (msg && Array.isArray(msg.content)) {
    textResult = msg.content
      .filter((c: any) => c.type === "output_text" && !!c.text)
      .map((c: any) => c.text)
      .join(" ")
  }

  return new Response(JSON.stringify({ output_text: textResult }), {
    headers: { "Content-Type": "application/json" }
  })
}
