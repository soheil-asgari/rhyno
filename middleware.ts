// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  const { data: { user } } = await supabase.auth.getUser()
  const url = request.nextUrl

  if (url.pathname.startsWith('/api')) {
    return response
  }

  const publicRoutes = ["/", '/login', '/signup', '/landing', '/about', '/contact', '/blog', '/services', '/company', '/checkout', '/bi', '/enterprise']
  const isPublicRoute = publicRoutes.some(route =>
    url.pathname === route || (route !== '/' && url.pathname.startsWith(route))
  )

  if (!user && !isPublicRoute) {
    if (url.pathname.startsWith('/login')) {
      return response
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user) {
    // ⭐️ اصلاح مهم: اولویت مطلق با کاربر سازمانی ⭐️
    const appMode = request.cookies.get('rhyno_app_mode')?.value
    const isEnterprisePath = url.pathname.startsWith('/enterprise')

    if (appMode === 'enterprise') {
      // اگر کاربر سازمانی است و دارد به صفحه اصلی یا لاگین یا ستاپ می‌رود -> بفرست به پورتال
      // نکته: اجازه میدهیم اگر در مسیرهای خود /enterprise هست، همانجا بماند
      if (['/', '/login', '/setup'].includes(url.pathname)) {
        return NextResponse.redirect(new URL('/enterprise/portal', request.url))
      }
      // اگر کاربر در مسیر سازمانی است، کاری نداریم و میدل‌ور تمام می‌شود
      if (isEnterprisePath) {
        return response
      }
    }

    // منطق عادی برای کاربران غیر سازمانی
    if (url.pathname === '/login' || url.pathname === '/signup' || url.pathname === '/') {
      const nextParam = url.searchParams.get('next')
      if (nextParam && nextParam.startsWith('/')) {
        return NextResponse.redirect(new URL(nextParam, request.url))
      }

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

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|auth|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
}