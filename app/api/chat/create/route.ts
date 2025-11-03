import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Database } from "@/supabase/types"

// این بخش مشخصات پرونده جدید را چک می‌کند
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
  const cookieStore = cookies()
  const supabase = createSSRClient(cookieStore)

  try {
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = createChatSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    // نگهبان، مهر رسمی خودش (user.id) را روی پرونده می‌زند
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
