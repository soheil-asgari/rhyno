// مسیر فایل: src/app/api/chat/create/route.ts

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Database } from "@/supabase/types"

// ... (اسکیما Zod شما - بدون تغییر)
const createChatSchema = z.object({
  workspace_id: z.string().uuid(),
  assistant_id: z.string().uuid().nullable(),
  context_length: z.number(),
  include_profile_context: z.boolean(),
  include_workspace_instructions: z.boolean(),
  model: z.string(),
  name: z.string(),
  prompt: z.string(),
  temperature: z.number(),
  embeddings_provider: z.enum(["openai", "local"])
})

export async function POST(request: NextRequest) {
  let supabase
  let user = null

  try {
    const authHeader = request.headers.get("Authorization")
    const token = authHeader?.split("Bearer ")[1]

    if (token) {
      // --- شروع اصلاحیه (شاخه موبایل) ---
      // مطابقت دقیق با امضای *قدیمی* (deprecated)
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return undefined
            },
            set(name: string, value: string, options: CookieOptions) {
              // کاری انجام نده
            },
            remove(name: string, options: CookieOptions) {
              // کاری انجام نده
            }
            // getAll() حذف شد تا با امضای قدیمی مطابقت داشته باشد
          },
          global: {
            headers: { Authorization: `Bearer ${token}` }
          }
        }
      )
      const { data: userData } = await supabase.auth.getUser(token)
      user = userData.user
      // --- پایان اصلاحیه (شاخه موبایل) ---
    } else {
      // --- شروع اصلاحیه (شاخه وب) ---
      // مطابقت دقیق با امضای *قدیمی* (deprecated)
      const cookieStore = cookies()
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: CookieOptions) {
              try {
                cookieStore.set({ name, value, ...options })
              } catch (error) {
                /* ignore */
              }
            },
            remove(name: string, options: CookieOptions) {
              try {
                cookieStore.set({ name, value: "", ...options })
              } catch (error) {
                /* ignore */
              }
            }
            // getAll() حذف شد تا با امضای قدیمی مطابقت داشته باشد
          }
        }
      )
      const { data: userData } = await supabase.auth.getUser()
      user = userData.user
      // --- پایان اصلاحیه (شاخه وب) ---
    }

    // 3. بررسی نهایی احراز هویت
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // 4. ادامه منطق شما (بدون تغییر)
    const body = await request.json()
    const validation = createChatSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const chatData = {
      ...validation.data,
      user_id: user.id
    }

    const { data: newChat, error } = await supabase
      .from("chats")
      .insert(chatData)
      .select()
      .single()

    if (error) {
      console.error("Error creating chat:", error)
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json(newChat, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
