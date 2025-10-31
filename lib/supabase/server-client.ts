// lib/supabase/server-client.ts
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/supabase/types"

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // فقط برای سرور
)
