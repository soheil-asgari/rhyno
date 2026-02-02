import OpenAI from "openai"
import { NextResponse } from "next/server"

// تابع برای API route
export async function handleDalleRequest(
  openai: OpenAI,
  messages: any[]
): Promise<NextResponse> {
  console.log("--- 5. Inside handleDalleRequest function! ---") // لاگ شماره ۵
  const lastMessage = messages[messages.length - 1]
  const prompt = lastMessage?.content
  console.log("--- 6. Extracted prompt:", prompt) // لاگ شماره ۶

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json(
      { message: "A valid text prompt is required for DALL-E 3." },
      { status: 400 }
    )
  }

  try {
    console.log(`Generating DALL-E 3 image with prompt: "${prompt}"`)
    console.log("--> Final prompt being sent to OpenAI:", prompt)
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1792x1024",
      quality: "hd"
    })

    // const imageResponse = await openai.responses.create({
    //   model: "gpt-5",
    //   input: prompt,
    //   tools: [{ type: "image_generation" }],
    // });

    console.log("Response from OpenAI:", JSON.stringify(imageResponse, null, 2))

    const imageUrl = imageResponse?.data?.[0]?.url

    if (!imageUrl) {
      throw new Error("Image URL not found in the OpenAI response.")
    }

    return NextResponse.json({ imageUrl })
  } catch (error: any) {
    console.error("Error generating image with DALL-E 3:", error)
    const errorMessage =
      error.response?.data?.error?.message ||
      error.message ||
      "An unknown error occurred."
    return NextResponse.json(
      { message: `Failed to generate image: ${errorMessage}` },
      { status: 500 }
    )
  }
}
