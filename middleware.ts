import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { i18nRouter } from 'next-i18n-router';
import i18nConfig from './i18nConfig';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const i18nResponse = i18nRouter(request, i18nConfig);
  if (i18nResponse) {
    response = i18nResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const publicRoutes = ['/login', '/signup'];

  if (user) {
    // اگر کاربر شماره تلفن نداشت و در صفحه تأیید نبود، او را به صفحه تأیید ببر
    if (!user.phone && pathname !== '/verify-phone') {
      return NextResponse.redirect(new URL('/verify-phone', request.url));
    }

    // اگر کاربر شماره تلفن داشت و در صفحات عمومی (لاگین/ثبت‌نام) بود، او را به صفحه اصلی ببر
    if (user.phone && publicRoutes.includes(pathname)) {
      return NextResponse.redirect(new URL('/', request.url));
    }

  }

  return response;
}

// 👇✅ اصلاح اصلی matcher: مسیرهای login و signup از لیست استثناها حذف شدند
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|auth).*)',
  ],
};