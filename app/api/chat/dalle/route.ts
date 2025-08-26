// in /api/dalle/route.ts

import { NextResponse } from "next/server"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import OpenAI from "openai"
import { handleDalleRequest } from "@/lib/dalle-handler"

export const runtime = "edge"

export async function POST(request: Request) {
  console.log("--- 1. API Route /api/dalle was HIT! ---") // لاگ شماره ۱

  try {
    console.log("--- 2. Inside try block. About to parse request.json(). ---") // لاگ شماره ۲
    const { prompt } = await request.json()
    console.log("--- 3. Successfully parsed prompt:", prompt) // لاگ شماره ۳

    if (!prompt || typeof prompt !== "string") {
      console.log("--- X. ERROR: Prompt is invalid. Returning 400. ---") // لاگ خطا
      return NextResponse.json(
        { message: "A valid text prompt is required for DALL-E 3." },
        { status: 400 }
      )
    }

    const profile = await getServerProfile()
    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    console.log("--- 4. Calling handleDalleRequest... ---") // لاگ شماره ۴
    return await handleDalleRequest(openai, [{ role: "user", content: prompt }])
  } catch (error: any) {
    console.error(
      "--- X. CRITICAL ERROR in /api/dalle POST function ---",
      error
    ) // لاگ خطا
    const errorMessage = error.message || "An unknown error occurred"
    return NextResponse.json(
      { message: `Failed to generate image: ${errorMessage}` },
      { status: 500 }
    )
  }
}
