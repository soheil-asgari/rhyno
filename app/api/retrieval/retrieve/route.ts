import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { userInput, fileIds, sourceCount } = json as {
      userInput: string
      fileIds: string[]
      sourceCount: number
    }

    const uniqueFileIds = [...new Set(fileIds)]

    console.log("Initializing Supabase client...")
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log("Fetching server profile...")
    const profile = await getServerProfile()

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

    const mostSimilarChunks = openaiFileItems?.sort(
      (a, b) => b.similarity - a.similarity
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
