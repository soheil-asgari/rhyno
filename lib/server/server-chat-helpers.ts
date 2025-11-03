import { Database, Tables } from "@/supabase/types"
import { VALID_ENV_KEYS } from "@/types/valid-keys"
import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { SupabaseClient } from "@supabase/supabase-js"

// ✅ کد اصلاح شده در server-chat-helpers.ts

export async function getServerProfile(
  userId: string,
  supabaseAdmin: SupabaseClient // ✨ ورودی جدید
) {
  // 👇 ۳. تمام کدهای ساخت کلاینت داخلی حذف شد
  // const cookieStore = cookies()
  // const supabase = createServerClient(...)

  if (!userId) {
    throw new Error("User ID was not provided to getServerProfile")
  }

  // 👇 ۴. از کلاینت ادمینِ ورودی برای کوئری استفاده کنید
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)

  if (error || !profiles || profiles.length === 0) {
    console.error(
      "Error fetching profile by user_id:",
      error?.message || "No profiles found"
    )
    throw new Error(`Profile not found for user_id: ${userId}`)
  }

  // اولین پروفایل را برمی‌داریم (برای حل مشکل ردیف‌های تکراری)
  const profile = profiles[0]

  const profileWithKeys = addApiKeysToProfile(profile)
  return profileWithKeys
}
function addApiKeysToProfile(profile: Tables<"profiles">) {
  const apiKeys = {
    [VALID_ENV_KEYS.OPENAI_API_KEY]: "openai_api_key",
    [VALID_ENV_KEYS.ANTHROPIC_API_KEY]: "anthropic_api_key",
    [VALID_ENV_KEYS.GOOGLE_GEMINI_API_KEY]: "google_gemini_api_key",
    [VALID_ENV_KEYS.MISTRAL_API_KEY]: "mistral_api_key",
    [VALID_ENV_KEYS.GROQ_API_KEY]: "groq_api_key",
    [VALID_ENV_KEYS.PERPLEXITY_API_KEY]: "perplexity_api_key",
    [VALID_ENV_KEYS.AZURE_OPENAI_API_KEY]: "azure_openai_api_key",
    [VALID_ENV_KEYS.OPENROUTER_API_KEY]: "openrouter_api_key",

    [VALID_ENV_KEYS.OPENAI_ORGANIZATION_ID]: "openai_organization_id",

    [VALID_ENV_KEYS.AZURE_OPENAI_ENDPOINT]: "azure_openai_endpoint",
    [VALID_ENV_KEYS.AZURE_GPT_35_TURBO_NAME]: "azure_openai_35_turbo_id",
    [VALID_ENV_KEYS.AZURE_GPT_45_VISION_NAME]: "azure_openai_45_vision_id",
    [VALID_ENV_KEYS.AZURE_GPT_45_TURBO_NAME]: "azure_openai_45_turbo_id",
    [VALID_ENV_KEYS.AZURE_EMBEDDINGS_NAME]: "azure_openai_embeddings_id"
  }

  for (const [envKey, profileKey] of Object.entries(apiKeys)) {
    if (process.env[envKey]) {
      ;(profile as any)[profileKey] = process.env[envKey]
    }
  }

  return profile
}

export function checkApiKey(apiKey: string | null, keyName: string) {
  if (apiKey === null || apiKey === "") {
    throw new Error(`${keyName} API Key not found`)
  }
}
