import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { NextRequest, NextResponse } from "next/server"
// ✨ ۱. ایمپورت‌های مورد نیاز برای احراز هویت
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"

export const runtime = "nodejs"

// ✨ ۲. تابع باید آبجکت `request` را بپذیرد
export async function GET(request: Request) {
  try {
    // ✨ ۳. استخراج و اعتبارسنجی توکن (دقیقاً مثل POST)
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

    // ✨ ۴. ساخت کلاینت Supabase
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    // ✨ ۵. گرفتن کاربر با استفاده از توکن

    console.log(`✅ GET: User ${userId} authenticated.`)

    // ✨ ۶. ادامه کد شما...
    const profile = await getServerProfile(userId, supabaseAdmin) // ✅ این خط حالا به درستی کار می‌کند

    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    const myAssistants = await openai.beta.assistants.list({
      limit: 100
    })

    return new Response(JSON.stringify({ assistants: myAssistants.data }), {
      status: 200
    })
  } catch (error: any) {
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
