import { OpenAIStream, StreamingTextResponse } from "ai"
import { NextResponse } from "next/server"
import OpenAI from "openai"

export const runtime = "edge"

export async function POST(request: Request) {
  try {
    const { messages } = await request.json()

    if (!messages) {
      return NextResponse.json(
        { message: "Messages are required" },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { message: "API Key not configured" },
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1"
    })

    const response = await openai.chat.completions.create({
      model: "openai/gpt-oss-20b:free",
      messages: messages,
      // prompt: "you are rhyno free",
      stream: true
    })

    // ✨ تغییر کلیدی: با افزودن `as any` مشکل عدم تطابق تایپ‌ها حل می‌شود.
    const stream = OpenAIStream(response as any)

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    console.error("Error in free-chat API:", error)
    return NextResponse.json(
      { message: error.message || "An unexpected error occurred" },
      {
        status: error.status || 500
      }
    )
  }
}
