import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // console.log("Middleware: Processing URL:", request.nextUrl.pathname, request.nextUrl.search);
  // console.log("Middleware: Cookies:", request.cookies.getAll());

  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const value = request.cookies.get(name)?.value;
          // console.log("Middleware: Getting cookie:", { name, value });
          return value;
        },
        set(name: string, value: string, options: CookieOptions) {
          console.log("Middleware: Setting cookie:", { name, value: value.slice(0, 50) + (value.length > 50 ? "..." : ""), options });
          try {
            // اعتبارسنجی مقدار کوکی
            if (!value || typeof value !== "string") {
              // console.error("Middleware: Invalid cookie value:", { name, value });
              return;
            }
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({
              request: {
                headers: request.headers
              }
            });
            response.cookies.set({ name, value, ...options });
          } catch (e) {
            // console.error("Middleware: Error setting cookie:", { name, error: e });
          }
        },
        remove(name: string, options: CookieOptions) {
          // console.log("Middleware: Removing cookie:", { name, options });
          try {
            request.cookies.set({ name, value: '', ...options });
            response = NextResponse.next({
              request: {
                headers: request.headers
              }
            });
            response.cookies.set({ name, value: '', ...options });
          } catch (e) {
            // console.error("Middleware: Error removing cookie:", { name, error: e });
          }
        }
      }
    }
  );

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  // console.log("Middleware: User data:", user ? { id: user.id, email: user.email, phone: user.phone } : null, "Error:", error);

  const { pathname } = request.nextUrl;
  const publicRoutes = ["/", '/login', '/signup', '/landing'];
  // (هر مسیر عمومی دیگری مثل /blog یا /about را به این لیست اضافه کنید)

  const isPublicRoute = publicRoutes.some((route: string) => {
    if (route === '/') {
      return pathname === '/'; // فقط صفحه اصلی
    }
    return pathname.startsWith(route); // صفحات دیگر
  });

  // ❗️❗️ بخش اضافه شده: دروازه برای کاربران لاگین نکرده ❗️❗️
  // ۲. اگر کاربر لاگین نکرده و روی یک مسیر عمومی هم نیست...
  if (!user && !isPublicRoute) {
    // ...او را به صفحه لاگین بفرست.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // (اختیاری) می‌توانید آدرس فعلی را به عنوان پارامتر بفرستید
    // تا بعد از لاگین به همین صفحه برگردد
    // url.searchParams.set('next', pathname)
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  // const publicRoutes = ['/login', '/signup', '/landing', '/blog', '/app', '/about', '/contact'];
  // const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  const workspaceidPattern = /^[0-9a-fA-F-]{36}$/;
  const authRedirectRoutes = ['/login', '/signup', '/landing'];
  const shouldRedirectFromAuthRoute = authRedirectRoutes.some(route => pathname.startsWith(route));

  if (user && user.phone && workspaceidPattern.test(pathname.slice(1)) && !pathname.endsWith("/chat")) {
    // console.log("Middleware: Redirecting from", pathname, "to", `${pathname}/chat`);
    return NextResponse.redirect(new URL(`${pathname}/chat`, request.url));
  }

  if (user) {
    const isOnVerifyPage = pathname === '/verify-phone';
    const isOnSetupPage = pathname === '/setup';

    // اولویت ۱: بررسی تایید شماره تلفن
    if (!user.phone && !isOnVerifyPage) {
      return NextResponse.redirect(new URL('/verify-phone', request.url));
    }

    // اگر شماره تلفن تایید شده، وضعیت workspace را بررسی کن
    if (user.phone) {
      const { data: homeWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_home", true)
        .single();

      const hasHomeWorkspace = !!homeWorkspace;

      // اولویت ۲: بررسی ساخت workspace
      // اگر workspace ندارد و در صفحه setup هم نیست، او را به setup بفرست
      if (!hasHomeWorkspace && !isOnSetupPage) {
        return NextResponse.redirect(new URL('/setup', request.url));
      }

      // اگر کاربر کاملاً آماده است و به صفحات عمومی یا مراحل اولیه رفته، او را به صفحه اصلی ببر
      if (hasHomeWorkspace && (shouldRedirectFromAuthRoute || isOnSetupPage || isOnVerifyPage)) {
        return NextResponse.redirect(new URL(`/${homeWorkspace.id}/chat`, request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - auth (auth routes)
     * - favicon.ico (favicon file)
     * - sitemap.xml (sitemap file)
     * - robots.txt (robots file)
     * - anything inside 'public' folder that has an extension (e.g., .png, .svg, .json)
     */
    '/((?!api|_next/static|_next/image|auth|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)'
  ]
}