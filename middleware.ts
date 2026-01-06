import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. ساختن یک Response اولیه (که در تمام طول میدلور معتبر باشد)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. تنظیم کلاینت Supabase با متدهای صحیح (getAll / setAll)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // این بخش حیاتی است: هم روی ریکوئست ست می‌کنیم (برای استفاده آنی) هم روی ریسپانس
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. دریافت وضعیت کاربر (نکته: از getUser استفاده کنید چون امن‌تر است)
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl
  const pathname = url.pathname

  // --- اگر مسیر API است، کاری نداشته باش ---
  if (pathname.startsWith('/api')) {
    return response
  }

  // --- مسیرهای عمومی ---
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

  // --- اگر کاربر لاگین کرده است ---
  if (user) {
    // A. بررسی حالت Enterprise
    const appMode = request.cookies.get('rhyno_app_mode')?.value

    if (appMode === 'enterprise') {
      if (['/', '/login', '/setup'].includes(pathname)) {
        return NextResponse.redirect(new URL('/enterprise/portal', request.url))
      }
      return response
    }

    // B. فقط اگر کاربر در صفحات لاگین/خانه است ریدارکت کن (جلوگیری از لوپ)
    const isAuthOrLandingPage = ['/login', '/signup', '/'].includes(pathname)

    if (!isAuthOrLandingPage) {
      return response
    }

    // C. منطق ریدایرکت به داشبورد
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
      .limit(1) // همیشه لیمیت بگذارید
      .maybeSingle() // بجای single که ارور ندهد

    if (homeWorkspace) {
      return NextResponse.redirect(new URL(`/${homeWorkspace.id}/chat`, request.url))
    } else {
      // اگر ورک‌اسپیس نداشت برود به setup (یا create-workspace)
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