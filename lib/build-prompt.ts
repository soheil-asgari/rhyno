import { Tables } from "@/supabase/types"
import { ChatPayload, MessageImage } from "@/types"
import { encode } from "gpt-tokenizer"
import { getBase64FromDataURL, getMediaTypeFromDataURL } from "@/lib/utils"

export const MODEL_PROMPTS: Record<string, string> = {
  "gpt-3.5-turbo":
    "You are a friendly, helpful AI assistant. Your name is Rhyno v1 and Use emojis when necessary.",
  "gpt-3.5-turbo-16k":
    "You are a friendly AI with extended memory. Your name is Rhyno v1 Pro and Use emojis when necessary and speak persian.",
  "gpt-4":
    "You are a highly intelligent AI assistant. Your name is Rhyno v2 and Use emojis when necessary.",
  "gpt-4-turbo":
    "You are a faster, cost-efficient AI assistant. Your name is Rhyno V4 Turbo and Use emojis when necessary.",
  "gpt-4-turbo-preview":
    "You are an experimental fast AI assistant. Your name is Rhyno V4 Preview and Use emojis when necessary.",
  "gpt-4o":
    "You are a powerful AI assistant with extended reasoning. Your name is Rhyno v4.1 and Use emojis when necessary.",
  "gpt-4o-mini":
    "You are a mini version of AI assistant. Your name is Rhyno v4 mini and Use emojis when necessary.",
  "gpt-5":
    "You are GPT-5 AI assistant. Your name is Rhyno v5 and Use emojis when necessary.",
  "gpt-5-mini":
    "You are GPT-5 mini AI assistant. Your name is Rhyno v5 mini and Use emojis when necessary.",
  "gpt-5-nano":
    "You are GPT-5 nano AI assistant. Your name is Rhyno v5 nano and Use emojis when necessary.",
  "gpt-realtime":
    "You are Rhyno Live, respond in real-time Persian voice and text",
  "gpt-realtime-mini":
    "You are Rhyno Live Mini, a real-time Persian chat assistant. Always respond in fluent Persian. When the user asks about 'آذر یورد تبریز' or 'Azar Yord', refer them to: https://azaryourdtabriz.com/.",

  "gpt-5-codex":
    "You are Rhyno Code V1, expert in programming and code assistance and Use emojis when necessary.",
  "google/gemini-2.5-flash-image":
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

export async function buildFinalMessages(
  payload: ChatPayload,
  profile: Tables<"profiles">,
  chatImages: MessageImage[]
) {
  // اگر مدل DALL-E 3 باشه، چیزی برنمی‌گردونیم چون منطق توی dalleHandler مدیریت می‌شه
  if (payload.chatSettings.model === "dall-e-3") {
    return [
      {
        role: "user",
        content:
          payload.chatMessages[payload.chatMessages.length - 1].message.content
      }
    ]
  }

  // console.log("Inside buildFinalMessages", buildFinalMessages)
  // console.log("payload", JSON.stringify(payload, null, 2))

  const {
    chatSettings,
    workspaceInstructions,
    chatMessages,
    assistant,
    messageFileItems,
    chatFileItems
  } = payload
  const fullName = profile.display_name || profile.username || ""
  const firstName = fullName.split(" ")[0] // "soheil asgari" را به "soheil" تبدیل می‌کند

  let modelPrompt = MODEL_PROMPTS[chatSettings.model]
  if (!modelPrompt) {
    throw new Error(`No prompt found for model: ${chatSettings.model}`)
  }
  if (firstName) {
    modelPrompt += ` The user's first name is ${firstName}. Address them by their first name in your responses. and say hello once`
  }
  // 🎤 استثنا برای مدل‌های Realtime → فقط پرامپت ساده برگردون
  if (chatSettings.model.includes("realtime")) {
    return [
      {
        role: "system",
        content: modelPrompt
      }
    ]
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
  let usedTokens = BUILT_PROMPT_TOKENS

  const processedChatMessages = chatMessages.map((chatMessage, index) => {
    const nextChatMessage = chatMessages[index + 1]

    if (nextChatMessage === undefined) {
      return chatMessage
    }

    const nextChatMessageFileItems = nextChatMessage.fileItems

    if (nextChatMessageFileItems.length > 0) {
      const findFileItems = nextChatMessageFileItems
        .map(fileItemId =>
          chatFileItems.find(chatFileItem => chatFileItem.id === fileItemId)
        )
        .filter(item => item !== undefined) as Tables<"file_items">[]

      const retrievalText = buildRetrievalText(findFileItems)

      return {
        message: {
          ...chatMessage.message,
          content:
            `${chatMessage.message.content}\n\n${retrievalText}` as string
        },
        fileItems: []
      }
    }

    return chatMessage
  })

  let finalMessages = []

  for (let i = processedChatMessages.length - 1; i >= 0; i--) {
    const message = processedChatMessages[i].message
    const messageTokens = encode(message.content).length

    if (messageTokens <= remainingTokens) {
      remainingTokens -= messageTokens
      usedTokens += messageTokens
      finalMessages.unshift(message)
    } else {
      break
    }
  }

  let tempSystemMessage: Tables<"messages"> = {
    chat_id: "",
    assistant_id: null,
    content: BUILT_PROMPT,
    created_at: "",
    id: processedChatMessages.length + "",
    image_paths: [],
    model: payload.chatSettings.model,
    role: "system",
    sequence_number: processedChatMessages.length,
    updated_at: "",
    file_url: null,
    user_id: "",
    audio_url: ""
  }

  finalMessages.unshift(tempSystemMessage)

  finalMessages = finalMessages.map(message => {
    let content

    if (message.image_paths && message.image_paths.length > 0) {
      content = [
        {
          type: "text",
          text: message.content
        },
        ...message.image_paths.map(path => {
          let formedUrl = ""
          if (path.startsWith("data:")) {
            formedUrl = path
          } else {
            const chatImage = chatImages.find(image => image.path === path)
            if (chatImage) {
              formedUrl = chatImage.base64
            }
          }
          return {
            type: "image_url",
            image_url: {
              url: formedUrl
            }
          }
        })
      ]
    } else {
      content = message.content
    }

    return {
      role: message.role,
      content
    }
  })

  if (messageFileItems.length > 0) {
    const retrievalText = buildRetrievalText(messageFileItems)

    finalMessages[finalMessages.length - 1] = {
      ...finalMessages[finalMessages.length - 1],
      content: `${
        finalMessages[finalMessages.length - 1].content
      }\n\n${retrievalText}`
    }
  }

  return finalMessages
}

function buildRetrievalText(fileItems: Tables<"file_items">[]) {
  const retrievalText = fileItems
    .map(item => `<BEGIN SOURCE>\n${item.content}\n</END SOURCE>`)
    .join("\n\n")

  return `You may use the following sources if needed to answer the user's question. If you don't know the answer, say "I don't know."\n\n${retrievalText}`
}

function adaptSingleMessageForGoogleGemini(message: any) {
  let adaptedParts = []

  let rawParts = []
  if (!Array.isArray(message.content)) {
    rawParts.push({ type: "text", text: message.content })
  } else {
    rawParts = message.content
  }

  for (let i = 0; i < rawParts.length; i++) {
    let rawPart = rawParts[i]

    if (rawPart.type == "text") {
      adaptedParts.push({ text: rawPart.text })
    } else if (rawPart.type === "image_url") {
      adaptedParts.push({
        inlineData: {
          data: getBase64FromDataURL(rawPart.image_url.url),
          mimeType: getMediaTypeFromDataURL(rawPart.image_url.url)
        }
      })
    }
  }

  let role = "user"
  if (["user", "system"].includes(message.role)) {
    role = "user"
  } else if (message.role === "assistant") {
    role = "model"
  }

  return {
    role: role,
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
