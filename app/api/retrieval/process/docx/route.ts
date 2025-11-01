import { processDocX } from "@/lib/retrieval/processing"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { FileItemChunk } from "@/types"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const { text, fileId, fileExtension } = json as {
      text: string
      fileId: string
      fileExtension: string
    }

    // Supabase client با Service Role
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // گرفتن توکن کاربر از هدر Authorization
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401
      })
    }
    const token = authHeader.split(" ")[1]

    // گرفتن پروفایل کاربر با توکن
    const profile = await getServerProfile(token)
    if (!profile?.openai_api_key) {
      return new Response(
        JSON.stringify({ message: "Unauthorized: missing OpenAI key" }),
        { status: 401 }
      )
    }

    checkApiKey(profile.openai_api_key, "OpenAI")

    let chunks: FileItemChunk[] = []

    switch (fileExtension) {
      case "docx":
        chunks = await processDocX(text)
        break
      default:
        return new NextResponse("Unsupported file type", { status: 400 })
    }

    const openai = new OpenAI({
      apiKey: profile.openai_api_key,
      organization: profile.openai_organization_id
    })

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks.map(chunk => chunk.content)
    })

    const embeddings = embeddingResponse.data.map(item => item.embedding)

    const file_items = chunks.map((chunk, index) => ({
      file_id: fileId,
      user_id: profile.user_id,
      content: chunk.content,
      tokens: chunk.tokens,
      openai_embedding: embeddings[index]
        ? JSON.stringify(embeddings[index])
        : null
    }))

    await supabaseAdmin.from("file_items").upsert(file_items)

    const totalTokens = file_items.reduce((acc, item) => acc + item.tokens, 0)
    await supabaseAdmin
      .from("files")
      .update({ tokens: totalTokens })
      .eq("id", fileId)

    return new NextResponse("Embed Successful", { status: 200 })
  } catch (error: any) {
    console.error("Error occurred:", error)
    const errorMessage =
      error.error?.message || error.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
