import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ServerRuntime } from "next"
import OpenAI from "openai"

// ✨ ۱. ایمپورت‌های مورد نیاز برای احراز هویت
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime: ServerRuntime = "edge"

// ✨ ۲. تابع باید آبجکت `request` را بپذیرد
export async function GET(request: Request) {
  try {
    // ✨ ۳. استخراج و اعتبارسنجی توکن (دقیقاً مثل POST)
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ GET: Auth header missing or invalid")
      return new Response(
        JSON.stringify({ message: "Unauthorized: Missing Bearer token" }),
        { status: 401 }
      )
    }
    const token = authHeader.split(" ")[1]

    // ✨ ۴. ساخت کلاینت Supabase
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    // ✨ ۵. گرفتن کاربر با استفاده از توکن
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("❌ GET: Supabase auth.getUser failed:", authError?.message)
      return new Response(
        JSON.stringify({ message: "Unauthorized: Invalid token" }),
        { status: 401 }
      )
    }

    const userId = user.id // ✅ حالا userId تعریف شده است
    console.log(`✅ GET: User ${userId} authenticated.`)

    // ✨ ۶. ادامه کد شما...
    const profile = await getServerProfile(userId) // ✅ این خط حالا به درستی کار می‌کند

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
