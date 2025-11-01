import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"

export const runtime = "edge"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { input } = json as { input: string }

    // گرفتن هدر Authorization
    const authHeader = request.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401
      })
    }
    const token = authHeader.split(" ")[1]

    // گرفتن پروفایل کاربر با توکن (فرض بر این است که getServerProfile می‌تواند توکن بگیرد)
    const profile = await getServerProfile(token)
    if (!profile?.openai_api_key) {
      return new Response(
        JSON.stringify({ message: "Unauthorized: missing OpenAI key" }),
        { status: 401 }
      )
    }

    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key,
      organization: profile.openai_organization_id
    })

    const response = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        { role: "system", content: "Respond to the user." },
        { role: "user", content: input }
      ],
      temperature: 0,
      max_tokens:
        CHAT_SETTING_LIMITS["gpt-4-turbo-preview"].MAX_TOKEN_OUTPUT_LENGTH
    })

    const content = response.choices[0].message.content

    return new Response(JSON.stringify({ content }), { status: 200 })
  } catch (error: any) {
    const errorMessage =
      error.error?.message || error.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
