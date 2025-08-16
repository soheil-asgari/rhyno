import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits";
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers";
import { ChatSettings } from "@/types";
import { createOpenAI } from "@ai-sdk/openai";
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

    checkApiKey(profile.perplexity_api_key, "Perplexity");

    // ایجاد کلاینت Perplexity با Vercel AI SDK
    const perplexity = createOpenAI({
      apiKey: profile.perplexity_api_key || "",
      baseURL: "https://api.perplexity.ai/",
    });

    // استریم پاسخ با Vercel AI SDK
    const result = await streamText({
      model: perplexity(chatSettings.model),
      messages,
      temperature: chatSettings.temperature,
      maxTokens: CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_TOKEN_OUTPUT_LENGTH || 4096, // مقدار پیش‌فرض برای جلوگیری از خطا
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred";
    const errorCode = error.status || 500;

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "Perplexity API Key not found. Please set it in your profile settings.";
    } else if (errorCode === 401) {
      errorMessage =
        "Perplexity API Key is incorrect. Please fix it in your profile settings.";
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode,
      headers: { "Content-Type": "application/json" },
    });
  }
}
