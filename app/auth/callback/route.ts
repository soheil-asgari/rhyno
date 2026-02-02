import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next")
  const origin = requestUrl.origin

  // ۱. تعیین آدرس بازگشت (پیش‌فرض: setup)
  // اگر next وجود داشته باشد، همان را استفاده می‌کنیم
  let redirectTo =
    next && next.startsWith("/") ? `${origin}${next}` : `${origin}/setup`

  // ۲. ساخت شیء پاسخ نهایی همین ابتدا
  // این کار باعث می‌شود کوکی‌ها مستقیماً روی پاسخی که حاوی ریدایرکت است سوار شوند
  const response = NextResponse.redirect(redirectTo)

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            // کوکی‌ها را مستقیماً روی پاسخ نهایی تنظیم می‌کنیم
            response.cookies.set({
              name,
              value,
              ...options
            })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value: "",
              ...options
            })
          }
        }
      }
    )

    // ۳. تبادل کد با نشست (Session)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      // ۴. منطق دیتابیس (فقط اگر آدرس مقصد مشخص نشده باشد، هوشمند عمل می‌کنیم)
      // اگر next وجود دارد (مثل /avatar)، به منطق زیر کاری نداریم و کاربر را مستقیم می‌فرستیم
      if (!next || next === "/") {
        // بررسی کیف پول
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", data.user.id)
          .single()

        if (!wallet) {
          await supabase.from("wallets").insert({
            user_id: data.user.id,
            amount_usd: 1,
            description: "خوش‌آمدگویی 1$"
          })
        }

        // پیدا کردن ورک‌اسپیس برای هدایت پیش‌فرض
        const { data: homeWorkspace } = await supabase
          .from("workspaces")
          .select("id")
          .eq("user_id", data.user.id)
          .eq("is_home", true)
          .single()

        if (homeWorkspace) {
          // تغییر آدرس ریدایرکت به چت روم اصلی
          const newRedirectUrl = `${origin}/${homeWorkspace.id}/chat?welcome=1`
          // آپدیت هدر Location در پاسخ موجود
          response.headers.set("Location", newRedirectUrl)
        }
      }
    } else {
      return NextResponse.redirect(`${origin}/login?message=Auth failed`)
    }
  } else {
    return NextResponse.redirect(`${origin}/login?message=No code`)
  }

  return response
}
