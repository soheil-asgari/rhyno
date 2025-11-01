import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { ServerRuntime } from "next"

import jwt from "jsonwebtoken"

export const runtime: ServerRuntime = "nodejs"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { userInput, fileIds, sourceCount } = json as {
      userInput: string
      fileIds: string[]
      sourceCount: number
    }

    const uniqueFileIds = [...new Set(fileIds)]

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

    const cookieStore = cookies() // این را برای کلاینت عمومی لازم داریم
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    if (!user) {
      return new Response("Unauthorized", { status: 401 })
    }

    const profile = await getServerProfile(userId, supabaseAdmin)
    console.log("Fetching server profile...")

    console.log("Checking API key for OpenAI...")
    checkApiKey(profile.openai_api_key, "OpenAI")

    console.log("Initializing OpenAI API client...")
    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    console.log("Generating embeddings for user input...")
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userInput
    })

    const openaiEmbedding = response.data[0]?.embedding
    if (!openaiEmbedding) {
      throw new Error("Failed to generate embedding")
    }

    console.log("Matching file items using Supabase RPC...")
    const { data: openaiFileItems, error: openaiError } =
      await supabaseAdmin.rpc("match_file_items_openai", {
        query_embedding: openaiEmbedding as any,
        match_count: sourceCount,
        file_ids: uniqueFileIds
      })

    if (openaiError) {
      console.error("Error during file matching:", openaiError)
      throw openaiError
    }

    const mostSimilarChunks = (openaiFileItems as any[])?.sort(
      (a: any, b: any) => b.similarity - a.similarity
    )

    return new Response(JSON.stringify({ results: mostSimilarChunks }), {
      status: 200
    })
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
