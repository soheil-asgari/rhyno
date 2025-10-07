// مسیر فایل: middleware.ts

import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// یک تابع کمکی برای مدیریت کوکی‌ها که کد را تمیزتر می‌کند
const createSupabaseClient = (request: NextRequest, response: NextResponse) => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options })
          response.cookies.set({ name, value: "", ...options })
        }
      }
    }
  )
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers }
  })

  const supabase = createSupabaseClient(request, response)

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  console.log(`[Middleware] Path: ${pathname}, User: ${user ? user.id : "Not logged in"}`);


  // مسیرهای عمومی که کاربر لاگین نکرده هم میتواند ببیند
  const publicRoutes = ['/login', '/signup', '/landing', '/blog', '/app', '/about', '/contact', '/payment/success']

  // اگر کاربر لاگین نیست
  if (!user) {
    // و سعی دارد به صفحه‌ای غیرعمومی دسترسی پیدا کند، او را به لاگین بفرست
    if (!publicRoutes.includes(pathname) && !pathname.startsWith('/auth')) {
      console.log("[Middleware] No user, redirecting to /login");
      return NextResponse.redirect(new URL('/login', request.url))
    }
    // در غیر این صورت اجازه بده به مسیرهای عمومی برود
    return response
  }

  // اگر کاربر لاگین است
  const hasPhone = !!user.phone

  // سناریو ۱: کاربر شماره تلفن ندارد
  if (!hasPhone) {
    // اگر در صفحه‌ای غیر از تایید شماره است، او را به آنجا بفرست
    if (pathname !== '/verify-phone') {
      console.log("[Middleware] User has no phone, redirecting to /verify-phone");
      return NextResponse.redirect(new URL('/verify-phone', request.url))
    }
    // اگر از قبل در صفحه تایید شماره است، اجازه بده بماند
    return response
  }

  // سناریو ۲: کاربر شماره تلفن دارد
  if (hasPhone) {
    // اگر سعی دارد به صفحات عمومی یا صفحه تایید شماره برود، او را به داشبورد اصلی بفرست
    if (publicRoutes.includes(pathname) || pathname === '/verify-phone') {
      console.log("[Middleware] User has phone, redirecting from public page to home workspace");

      // منطق پیدا کردن workspace اصلی کاربر
      const { data: homeWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_home", true)
        .single()

      if (homeWorkspace) {
        return NextResponse.redirect(new URL(`/${homeWorkspace.id}/chat`, request.url))
      } else {
        // اگر workspace نداشت، به صفحه setup برود
        return NextResponse.redirect(new URL('/setup', request.url))
      }
    }
  }

  // در تمام حالت‌های دیگر، اجازه بده درخواست عبور کند
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ]
}