import { processDocX } from "@/lib/retrieval/processing"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { FileItemChunk } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { NextRequest, NextResponse } from "next/server"
import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import jwt from "jsonwebtoken"

export const runtime: ServerRuntime = "nodejs"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { text, fileId, fileExtension } = json as {
      text: string
      fileId: string
      fileExtension: string
    }

    // Supabase client با Service Role
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

    //
    // 🛑 === پایان بلوک احراز هویت ===
    //

    // (چک کردن موجودی کیف پول را اینجا اضافه کنید...)
    // (شما باید منطق چک کردن کیف پول را مانند فایل دیگر، اینجا هم اضافه کنید)
    const cookieStore = cookies() // این را برای کلاینت عمومی لازم داریم
    const supabase = createSSRClient(cookieStore)

    // گرفتن پروفایل کاربر با توکن
    const profile = await getServerProfile(userId, supabaseAdmin)
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
