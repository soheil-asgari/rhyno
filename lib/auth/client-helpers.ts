// lib/auth/client-helpers.ts

// مطمئن شوید که مسیر ایمپورت کلاینت Supabase شما درست است
import { supabase } from "@/lib/supabase/client"

/**
 * توکن دسترسی فعلی کاربر Supabase را دریافت می‌کند.
 * @returns توکن دسترسی کاربر یا null
 */
export const getUserAccessToken = async (): Promise<string | null> => {
  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession()

    if (error) {
      console.error("Supabase getSession error:", error)
      return null
    }

    if (session) {
      return session.access_token
    }

    return null
  } catch (err) {
    console.error("Error fetching user token:", err)
    return null
  }
}
