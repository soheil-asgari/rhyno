import { processDocX } from "@/lib/retrieval/processing"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Database } from "@/supabase/types"
import { FileItemChunk } from "@/types"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(req: Request) {
  const json = await req.json()
  const { text, fileId, fileExtension } = json as {
    text: string
    fileId: string
    fileExtension: string
  }

  try {
    console.log("Initializing Supabase client...")
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log("Fetching server profile...")
    const profile = await getServerProfile()
    console.log("Server profile fetched:", profile)

    console.log("Checking API key for OpenAI...")
    checkApiKey(profile.openai_api_key, "OpenAI")
    console.log("API key valid for OpenAI.")

    let chunks: FileItemChunk[] = []

    console.log(`Processing file with extension: ${fileExtension}`)
    switch (fileExtension) {
      case "docx":
        console.log("Processing DOCX file...")
        chunks = await processDocX(text)
        console.log(`Processed DOCX file, found ${chunks.length} chunks.`)
        break
      default:
        console.log("Unsupported file type")
        return new NextResponse("Unsupported file type", {
          status: 400
        })
    }

    let embeddings: any[] = []

    console.log("Initializing OpenAI API client...")
    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })
    console.log("OpenAI API client initialized.")

    console.log("Generating embeddings for chunks...")
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks.map(chunk => chunk.content)
    })
    console.log("Embeddings generated:", response.data)

    embeddings = response.data.map((item: any) => item.embedding)
    console.log("Embeddings processed.")

    // Prepare data for saving to database
    const file_items = chunks.map((chunk, index) => ({
      file_id: fileId,
      user_id: profile.user_id,
      content: chunk.content,
      tokens: chunk.tokens,
      openai_embedding: embeddings[index] || null
    }))
    console.log("Prepared data for file_items:", file_items)

    // Save data to Supabase
    console.log("Inserting file items into the database...")
    await supabaseAdmin.from("file_items").upsert(file_items)
    console.log("Data inserted into file_items.")

    // Calculate and update total tokens
    const totalTokens = file_items.reduce((acc, item) => acc + item.tokens, 0)
    console.log("Total tokens calculated:", totalTokens)

    await supabaseAdmin
      .from("files")
      .update({ tokens: totalTokens })
      .eq("id", fileId)
    console.log("Tokens updated in the files table.")

    return new NextResponse("Embed Successful", {
      status: 200
    })
  } catch (error: any) {
    console.error("Error occurred:", error)
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
