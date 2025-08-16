import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits";
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers";
import { getBase64FromDataURL, getMediaTypeFromDataURL } from "@/lib/utils";
import { ChatSettings } from "@/types";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const json = await request.json();
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings;
    messages: any[];
  };

  try {
    const profile = await getServerProfile();

    checkApiKey(profile.anthropic_api_key, "Anthropic");

    // فرمت کردن پیام‌ها برای Anthropic
    const ANTHROPIC_FORMATTED_MESSAGES = messages.slice(1).map((message: any) => {
      const messageContent =
        typeof message?.content === "string"
          ? [{ type: "text", text: message.content }]
          : message?.content;

      return {
        ...message,
        content: messageContent.map((content: any) => {
          if (typeof content === "string") {
            return { type: "text", text: content };
          } else if (
            content?.type === "image_url" &&
            content?.image_url?.url?.length
          ) {
            return {
              type: "image",
              source: {
                type: "base64",
                media_type: getMediaTypeFromDataURL(content.image_url.url),
                data: getBase64FromDataURL(content.image_url.url),
              },
            };
          }
          return content;
        }),
      };
    });

    // استریم پاسخ با استفاده از Vercel AI SDK
    const result = await streamText({
      model: anthropic(chatSettings.model),
      messages: ANTHROPIC_FORMATTED_MESSAGES,
      temperature: chatSettings.temperature,
      system: messages[0].content,
      maxTokens: CHAT_SETTING_LIMITS[chatSettings.model].MAX_TOKEN_OUTPUT_LENGTH,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred";
    const errorCode = error.status || 500;

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "Anthropic API Key not found. Please set it in your profile settings.";
    } else if (errorCode === 401) {
      errorMessage =
        "Anthropic API Key is incorrect. Please fix it in your profile settings.";
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode,
      headers: { "Content-Type": "application/json" },
    });
  }
}
