// app/api/transcribe/route.ts

// ✨ ۱. ایمپورت‌های مورد نیاز برای احراز هویت دستی
import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"

// ایمپورت‌های اصلی شما
import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { handleSTT } from "@/app/api/chat/handlers/stt"
import type { Database } from "@/supabase/types"
import { User } from "@supabase/supabase-js" // ✨ ایمپورت تایپ User

export async function POST(request: NextRequest) {
  // کلاینت عمومی (برای وب‌سایت یا استفاده در handleSTT)
  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ... (کد شما)
          }
        }
      }
    }
  )

  try {
    //
    // 🛑 === شروع بلوک احراز هویت دوگانه ===
    //
    let user: User | null = null
    const authHeader = request.headers.get("Authorization")

    if (authHeader && authHeader.startsWith("Bearer ")) {
      // --- مسیر موبایل (Bearer Token) ---
      console.log("[transcribe] Auth: در حال اعتبارسنجی با Bearer token...")
      const token = authHeader.split(" ")[1]
      let userId: string

      try {
        if (!process.env.SUPABASE_JWT_SECRET) {
          throw new Error("SUPABASE_JWT_SECRET on server is not set!")
        }
        const decodedToken = jwt.verify(
          token,
          process.env.SUPABASE_JWT_SECRET
        ) as jwt.JwtPayload

        if (!decodedToken.sub) {
          throw new Error("Invalid token: No 'sub' (user ID) found.")
        }
        userId = decodedToken.sub
      } catch (err: any) {
        console.error(
          "[transcribe] ❌ اعتبارسنجی دستی توکن شکست خورد:",
          err.message
        )
        return new NextResponse(
          `Unauthorized: Manual verification failed: ${err.message}`,
          { status: 401 }
        )
      }

      // گرفتن آبجکت کامل User با کلاینت Admin
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY on server is not set!")
      }
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const {
        data: { user: adminUser },
        error: adminError
      } = await supabaseAdmin.auth.admin.getUserById(userId)

      if (adminError || !adminUser) {
        console.error(
          "[transcribe] ❌ کلاینت ادمین نتوانست کاربر را پیدا کند:",
          adminError?.message
        )
        return new NextResponse(
          `Unauthorized: User not found with admin client: ${adminError?.message}`,
          { status: 401 }
        )
      }
      user = adminUser // ✅ کاربر با موفقیت از طریق موبایل احراز هویت شد
    } else {
      // --- مسیر وب‌سایت (Cookie) ---
      console.log("[transcribe] Auth: در حال اعتبارسنجی با کوکی...")
      const {
        data: { user: cookieUser },
        error: cookieError
      } = await supabase.auth.getUser()

      if (cookieError || !cookieUser) {
        console.error(
          "[transcribe] ❌ احراز هویت با کوکی شکست خورد:",
          cookieError?.message
        )
        return NextResponse.json(
          { message: "Unauthorized (cookie)" },
          { status: 401 }
        )
      }
      user = cookieUser // ✅ کاربر با موفقیت از طریق وب احراز هویت شد
    }

    //
    // 🛑 === پایان بلوک احراز هویت ===
    //

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    console.log(`[transcribe] ✅ کاربر ${user.email} با موفقیت احراز هویت شد.`)

    // ✅ آبجکت user معتبر و کلاینت supabase عمومی به handleSTT پاس داده می‌شوند
    return await handleSTT({ request, user, supabase })
  } catch (error: any) {
    console.error("Error in /api/transcribe route:", error)
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
