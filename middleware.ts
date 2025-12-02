import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. ایجاد Response اولیه
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. تنظیم کلاینت Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
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

  // 3. دریافت وضعیت کاربر
  const { data: { user } } = await supabase.auth.getUser()
  const url = request.nextUrl
  const pathname = url.pathname

  // --- اگر مسیر API است، کاری نداشته باش ---
  if (pathname.startsWith('/api')) {
    return response
  }

  // --- منطق مسیرهای عمومی (Public) ---
  const publicRoutes = ["/", '/login', '/signup', '/landing', '/about', '/contact', '/blog', '/services', '/company', '/checkout', '/bi', '/enterprise']
  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || (route !== '/' && pathname.startsWith(route))
  )

  // --- اگر کاربر لاگین نکرده است ---
  if (!user && !isPublicRoute) {
    if (pathname.startsWith('/login')) {
      return response
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // --- اگر کاربر لاگین کرده است (بخش اصلی مشکل شما) ---
  if (user) {
    // A. بررسی حالت Enterprise
    const appMode = request.cookies.get('rhyno_app_mode')?.value
    const isEnterprisePath = pathname.startsWith('/enterprise')

    if (appMode === 'enterprise') {
      if (['/', '/login', '/setup'].includes(pathname)) {
        return NextResponse.redirect(new URL('/enterprise/portal', request.url))
      }
      // اگر کاربر سازمانی است و در مسیر درست است یا مسیر دیگری (مثل ادمین) را می‌خواهد، اجازه بده
      return response
    }

    // B. اصلاح مهم: فقط در صورتی ریدایرکت کن که کاربر در صفحات "ورود" یا "خانه" باشد.
    // اگر کاربر در /admin یا /uuid/chat است، این شرط False می‌شود و کد رد می‌شود.
    const isAuthOrLandingPage = ['/login', '/signup', '/'].includes(pathname)

    if (!isAuthOrLandingPage) {
      // اگر کاربر در صفحه ادمین یا چت خاص است، هیچ کاری نکن و اجازه بده برود
      return response
    }

    // C. منطق ریدایرکت به داشبورد (فقط برای صفحات لاگین/خانه اجرا می‌شود)
    // چک کردن پارامتر next (مثلاً اگر از ایمیل آمده باشد)
    const nextParam = url.searchParams.get('next')
    if (nextParam && nextParam.startsWith('/')) {
      return NextResponse.redirect(new URL(nextParam, request.url))
    }

    // پیدا کردن ورک‌اسپیس و ریدایرکت
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

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|auth|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
}