// app/api/chat/openrouter/route.ts

import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { ServerRuntime } from "next"
import OpenAI from "openai"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  try {
    const { chatSettings, messages } = (await request.json()) as {
      chatSettings: ChatSettings
      messages: any[]
    }
    const profile = await getServerProfile()
    checkApiKey(profile.openrouter_api_key, "OpenRouter")
    const openrouter = new OpenAI({
      apiKey: profile.openrouter_api_key || "",
      baseURL: "https://openrouter.ai/api/v1"
    })

    const responseStream = await openrouter.chat.completions.create({
      model: chatSettings.model as any,
      messages: messages as any,
      stream: true,
      // @ts-ignore
      modalities: ["image", "text"]
    })

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullText = ""
        let imageBase64 = ""

        for await (const chunk of responseStream) {
          const textDelta = chunk.choices[0]?.delta?.content || ""
          if (textDelta) {
            fullText += textDelta
          }

          // ✨ [FIX] از 'as any' برای رفع خطای تایپ‌اسکریپت استفاده می‌کنیم
          const imageDelta = (chunk.choices[0]?.delta as any)?.images

          if (imageDelta && imageDelta.length > 0) {
            const imageUrl = imageDelta[0]?.image_url?.url
            if (imageUrl && imageUrl.startsWith("data:image")) {
              imageBase64 += imageUrl.split(",")[1] || ""
            }
          }
        }

        const finalResponse = `${fullText}%%RHINO_IMAGE_SEPARATOR%%${imageBase64}`

        controller.enqueue(encoder.encode(finalResponse))
        controller.close()
      }
    })
    return new Response(readableStream)
  } catch (error: any) {
    console.error("OpenRouter API Error:", error)
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500
    })
  }
}
