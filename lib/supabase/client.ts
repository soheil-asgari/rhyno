// lib/supabase/client.ts

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/supabase/types" // اگر مسیر types متفاوت است، آن را اصلاح کنید

// یک کلاینت واحد برای استفاده در تمام کامپوننت‌های سمت کلاینت ("use client")
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
