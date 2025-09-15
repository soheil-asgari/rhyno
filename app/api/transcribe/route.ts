// app/api/transcribe/route.ts

import { createServerClient, type CookieOptions } from "@supabase/ssr" // ✨ Import CookieOptions
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { handleSTT } from "@/app/api/chat/handlers/stt"
import type { Database } from "@/supabase/types"

export async function POST(request: NextRequest) {
  // ✨ This object handles reading and writing cookies in the new format
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
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        }
      }
    }
  )

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    return await handleSTT({ request, user, supabase })
  } catch (error: any) {
    console.error("Error in /api/transcribe route:", error)
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
