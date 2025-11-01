import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"
import { NextRequest, NextResponse } from "next/server"
import { ServerRuntime } from "next"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"
import { createServerClient } from "@supabase/ssr"

export const runtime: ServerRuntime = "nodejs"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { input } = json as { input: string }

    // گرفتن هدر Authorization
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

    const cookieStore = cookies() //
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    // گرفتن پروفایل کاربر با توکن (فرض بر این است که getServerProfile می‌تواند توکن بگیرد)
    const profile = await getServerProfile(userId, supabaseAdmin)
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
