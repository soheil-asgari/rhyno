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
  const publicRoutes = ['/login', '/signup', '/payment/success', 'landing', 'blog'];

  const workspaceidPattern = /^[0-9a-fA-F-]{36}$/;
  if (user && user.phone && workspaceidPattern.test(pathname.slice(1)) && !pathname.endsWith("/chat")) {
    // console.log("Middleware: Redirecting from", pathname, "to", `${pathname}/chat`);
    return NextResponse.redirect(new URL(`${pathname}/chat`, request.url));
  }

  if (user) {
    if (!user.phone && pathname !== '/verify-phone') {
      // console.log("Middleware: Redirecting to /verify-phone for user:", user.id);
      return NextResponse.redirect(new URL('/verify-phone', request.url));
    }

    if (user.phone && (publicRoutes.includes(pathname) || pathname === '/verify-phone')) {
      const { data: homeWorkspace, error: workspaceError } = await supabase
        .from("workspaces")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("is_home", true)
        .single();
      if (workspaceError || !homeWorkspace) {
        // console.log("Middleware: No home workspace, redirecting to /setup for user:", user.id);
        return NextResponse.redirect(new URL('/setup', request.url));
      }
      // console.log("Middleware: Redirecting to workspace /:id/chat for user:", user.id, "Workspace:", { id: homeWorkspace.id, name: homeWorkspace.name });
      return NextResponse.redirect(new URL(`/${homeWorkspace.id}/chat`, request.url));
    }
  }

  // console.log("Middleware: Continuing to next response for path:", pathname);
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|auth|sitemap.xml|robots.txt).*)'
  ]
}
