import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // ۱. پاسخ اولیه را می‌سازیم
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // کوکی را هم در درخواست (برای ادامه مسیر) و هم در پاسخ (برای ذخیره در مرورگر) ست می‌کنیم
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // ۲. رفرش کردن سشن
  const { data: { user } } = await supabase.auth.getUser()

  // ۳. مدیریت مسیرها
  const url = request.nextUrl

  // لیست مسیرهای عمومی
  const publicRoutes = ["/", '/login', '/signup', '/landing', '/about', '/contact', '/blog', '/services']
  const isPublicRoute = publicRoutes.some(route =>
    url.pathname === route || (route !== '/' && url.pathname.startsWith(route))
  )

  // اگر کاربر لاگین نکرده و مسیر عمومی نیست -> ریدایرکت به لاگین
  if (!user && !isPublicRoute) {
    // جلوگیری از ریدایرکت تکراری اگر کاربر در حال حاضر در لاگین است
    if (url.pathname.startsWith('/login')) {
      return response;
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // اگر کاربر لاگین کرده است
  if (user) {
    // اگر در صفحه لاگین یا اصلی است، به دشبورد/چت بفرست
    if (url.pathname === '/login' || url.pathname === '/signup' || url.pathname === '/') {
      // اگر next دارد، به همانجا بفرست
      const nextParam = url.searchParams.get('next')
      if (nextParam && nextParam.startsWith('/')) {
        return NextResponse.redirect(new URL(nextParam, request.url))
      }

      // در غیر این صورت منطق ورک‌اسپیس
      if (user.phone) {
        const { data: homeWorkspace } = await supabase
          .from("workspaces")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_home", true)
          .single()

        if (homeWorkspace) {
          return NextResponse.redirect(new URL(`/${homeWorkspace.id}/chat`, request.url))
        } else {
          return NextResponse.redirect(new URL('/setup', request.url))
        }
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|auth|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
}