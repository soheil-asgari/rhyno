import { Tables } from "@/supabase/types"
import { ChatPayload, MessageImage } from "@/types"
import { encode } from "gpt-tokenizer"
import { getBase64FromDataURL, getMediaTypeFromDataURL } from "@/lib/utils"

export const MODEL_PROMPTS: Record<string, string> = {
  "gpt-3.5-turbo":
    "You are a friendly, helpful AI assistant. Your name is Rhyno v1 and Use emojis when necessary.",
  "gpt-3.5-turbo-16k":
    "You are a friendly AI with extended memory. Your name is Rhyno v1 Pro and Use emojis when necessary.",
  "gpt-4":
    "You are a highly intelligent AI assistant. Your name is Rhyno v2 and Use emojis when necessary.",
  "gpt-4-turbo":
    "You are a faster, cost-efficient AI assistant. Your name is Rhyno v3 Turbo and Use emojis when necessary.",
  "gpt-4-turbo-preview":
    "You are an experimental fast AI assistant. Your name is Rhyno v3 Preview and Use emojis when necessary.",
  "gpt-4o":
    "You are a powerful AI assistant with extended reasoning. Your name is Rhyno v4.1 and Use emojis when necessary.",
  "gpt-4o-mini":
    "You are a mini version of AI assistant. Your name is Rhyno v4 mini and Use emojis when necessary.",
  "gpt-4o-mini-tts":
    "You are Rhyno TTS, an AI that converts text to natural speech", // ✅ اضافه شد
  "gpt-4o-transcribe":
    "You are Rhyno Transcribe, an AI that converts speech to text accurately",
  "computer-use-preview":
    "You are Rhyno Auto, an AI that can interact with computer interfaces and automate tasks",
  "gpt-5":
    "You are GPT-5 AI assistant. Your name is Rhyno v5 and Use emojis when necessary.",
  "gpt-5-mini":
    "You are GPT-5 mini AI assistant. Your name is Rhyno v5 mini and Use emojis when necessary.",
  "gpt-5-nano":
    "You are GPT-5 nano AI assistant. Your name is Rhyno v5 nano and Use emojis when necessary.",
  "gpt-4o-realtime-preview-2025-06-03":
    "You are Rhyno Live, respond in real-time Persian voice and text",
  "gpt-4o-mini-realtime-preview-2024-12-17":
    "You are Rhyno Live Mini, real-time Persian chat assistant",
  "gpt-4.1":
    "You are Rhyno Code V1, expert in programming and code assistance and Use emojis when necessary.",
  "google/gemini-2.5-flash-image-preview":
    "You are Rhyno, a powerful image generation AI. Your primary function is to create and generate images based on the user's text. ALWAYS generate an image if the user's request implies a visual creation. You can also provide a short text description of the generated image."
}

const buildBasePrompt = (
  prompt: string,
  profileContext: string,
  workspaceInstructions: string,
  assistant: Tables<"assistants"> | null
) => {
  let fullPrompt = ""

  if (assistant) {
    fullPrompt += `<INJECT ROLE>\nYou are not an AI. You are ${assistant.name}.\n</INJECT ROLE>\n\n`
  }

  fullPrompt += `Today is ${new Date().toLocaleDateString()}.\n\n`

  if (profileContext) {
    fullPrompt += `User Info:\n${profileContext}\n\n`
  }

  if (workspaceInstructions) {
    fullPrompt += `System Instructions:\n${workspaceInstructions}\n\n`
  }

  fullPrompt += `User Instructions:\n${prompt}`

  return fullPrompt
}

// در فایل: lib/build-prompt.ts

export async function buildFinalMessages(
  payload: ChatPayload,
  profile: Tables<"profiles">,
  chatImages: MessageImage[]
) {
  if (payload.chatSettings.model === "dall-e-3") {
    return [
      {
        role: "user",
        content:
          payload.chatMessages[payload.chatMessages.length - 1].message.content
      }
    ]
  }

  const {
    chatSettings,
    workspaceInstructions,
    chatMessages,
    assistant,
    messageFileItems,
    chatFileItems
  } = payload

  const modelPrompt = MODEL_PROMPTS[chatSettings.model]
  if (!modelPrompt) {
    throw new Error(`No prompt found for model: ${chatSettings.model}`)
  }

  const BUILT_PROMPT = buildBasePrompt(
    modelPrompt,
    chatSettings.includeProfileContext ? profile.profile_context || "" : "",
    chatSettings.includeWorkspaceInstructions ? workspaceInstructions : "",
    assistant
  )

  const CHUNK_SIZE = chatSettings.contextLength
  const BUILT_PROMPT_TOKENS = encode(BUILT_PROMPT).length
  let remainingTokens = CHUNK_SIZE - BUILT_PROMPT_TOKENS

  let finalMessages: any[] = []

  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const message = chatMessages[i].message
    const messageTokens = encode(message.content).length

    if (messageTokens <= remainingTokens) {
      remainingTokens -= messageTokens
      finalMessages.unshift(message)
    } else {
      break
    }
  }

  const tempSystemMessage: Tables<"messages"> = {
    chat_id: "",
    assistant_id: null,
    content: BUILT_PROMPT,
    created_at: "",
    id: "system",
    image_paths: [],
    model: payload.chatSettings.model,
    role: "system",
    sequence_number: 0,
    updated_at: "",
    file_url: null,
    user_id: ""
  }

  finalMessages.unshift(tempSystemMessage)

  // ✨✨✨ شروع بخش اصلاح شده ✨✨✨
  const formattedMessages = finalMessages.map(message => {
    // پیدا کردن عکس‌های مرتبط با این پیام از state اصلی
    const imagesForThisMessage = chatImages.filter(
      img => img.messageId === message.id
    )

    let content: any

    if (imagesForThisMessage.length > 0) {
      // اگر عکس وجود داشت، فرمت چندبخشی (multi-part) می‌سازیم
      content = [
        {
          type: "text",
          text: message.content
        },
        ...imagesForThisMessage.map(image => ({
          type: "image_url",
          image_url: {
            url: image.url // ✨ مستقیماً از URL عمومی استفاده می‌کنیم
          }
        }))
      ]
    } else {
      // اگر عکسی نبود، فقط متن را قرار می‌دهیم
      content = message.content
    }

    return {
      role: message.role,
      content
    }
  })
  // ✨✨✨ پایان بخش اصلاح شده ✨✨✨

  // منطق مربوط به Retrieval بدون تغییر باقی می‌ماند
  if (messageFileItems.length > 0) {
    const retrievalText = buildRetrievalText(messageFileItems)
    formattedMessages[formattedMessages.length - 1].content +=
      `\n\n${retrievalText}`
  }

  return formattedMessages
}

function buildRetrievalText(fileItems: Tables<"file_items">[]) {
  const retrievalText = fileItems
    .map(item => `<BEGIN SOURCE>\n${item.content}\n</END SOURCE>`)
    .join("\n\n")

  return `You may use the following sources if needed to answer the user's question. If you don't know the answer, say "I don't know."\n\n${retrievalText}`
}

// در فایل: lib/build-prompt.ts

function adaptSingleMessageForGoogleGemini(message: any) {
  const adaptedParts: any[] = []

  const rawParts = Array.isArray(message.content)
    ? message.content
    : [{ type: "text", text: message.content }]

  for (const rawPart of rawParts) {
    if (rawPart.type === "text") {
      adaptedParts.push({ text: rawPart.text })
    } else if (rawPart.type === "image_url") {
      const imageUrl = rawPart.image_url.url

      // ✨✨✨ شروع بخش اصلاح شده ✨✨✨
      // تشخیص می‌دهیم که ورودی Base64 است یا URL
      if (imageUrl.startsWith("data:")) {
        // اگر Base64 بود، مانند قبل عمل می‌کنیم
        adaptedParts.push({
          inlineData: {
            data: getBase64FromDataURL(imageUrl),
            mimeType: getMediaTypeFromDataURL(imageUrl)
          }
        })
      } else {
        // ✨ اگر URL عمومی بود، باید آن را fetch کرده و به Base64 تبدیل کنیم
        // این یک راه حل موقت است. راه حل بهتر، ارسال مستقیم URL به Gemini است
        // اما برای حفظ سازگاری با کد فعلی، این کار را انجام می‌دهیم
        console.warn(
          "Image URL to Base64 conversion is not implemented yet for Gemini. Sending placeholder."
        )
        // در حالت ایده‌آل شما باید در بک‌اند این URL را fetch کرده و به Base64 تبدیل کنید.
        // برای اینکه کد کار کند، فعلا یک متن جایگزین می‌فرستیم.
        adaptedParts.push({ text: `[Image at ${imageUrl}]` })
      }
      // ✨✨✨ پایان بخش اصلاح شده ✨✨✨
    }
  }

  const role = message.role === "assistant" ? "model" : "user"

  return {
    role,
    parts: adaptedParts
  }
}

function adaptMessagesForGeminiVision(messages: any[]) {
  const basePrompt = messages[0].parts[0].text
  const baseRole = messages[0].role
  const lastMessage = messages[messages.length - 1]
  const visualMessageParts = lastMessage.parts
  let visualQueryMessages = [
    {
      role: "user",
      parts: [
        `${baseRole}:\n${basePrompt}\n\nuser:\n${visualMessageParts[0].text}\n\n`,
        visualMessageParts.slice(1)
      ]
    }
  ]
  return visualQueryMessages
}

export async function adaptMessagesForGoogleGemini(
  payload: ChatPayload,
  messages: any[]
) {
  let geminiMessages = []
  for (let i = 0; i < messages.length; i++) {
    let adaptedMessage = adaptSingleMessageForGoogleGemini(messages[i])
    geminiMessages.push(adaptedMessage)
  }

  if (payload.chatSettings.model === "gemini-pro-vision") {
    geminiMessages = adaptMessagesForGeminiVision(geminiMessages)
  }
  return geminiMessages
}
