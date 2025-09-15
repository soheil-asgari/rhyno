import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import type { Database } from "@/supabase/types"
import { z } from "zod"

const messageSchema = z.object({
  id: z.string().uuid(),
  chat_id: z.string().uuid(),
  user_id: z.string().uuid(), // We still validate it, but will overwrite it below
  content: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  model: z.string(),
  sequence_number: z.number().int(),
  assistant_id: z.string().uuid().nullable().optional(),
  image_paths: z.array(z.string()).default([]),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional()
})

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: cookiesToSet => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
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

    const body = await request.json()

    // ✨ Step 1: Create a new object with the CORRECT user ID from the session
    const messageWithCorrectUser = {
      ...body,
      user_id: user.id // Overwriting the user_id with the authenticated user's ID
    }

    // ✨ Step 2: Validate the NEW object
    const validation = messageSchema.safeParse(messageWithCorrectUser)
    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const messageToSave = validation.data

    // The old security check is no longer needed because we are enforcing the user_id
    // if (messageToSave.user_id !== user.id) { ... } // This is now redundant

    // ✨ Step 3: Insert the final, trusted object into the database
    const { data: savedMessage, error } = await supabase
      .from("messages")
      .insert(messageToSave)
      .select()
      .single()

    if (error) {
      console.error("Error saving message:", error)
      return NextResponse.json({ message: error.message }, { status: 500 })
    }

    return NextResponse.json(savedMessage, { status: 200 })
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON format" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}
