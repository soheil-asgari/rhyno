import { createClient } from "@/lib/supabase/middleware"
import { i18nRouter } from "next-i18n-router"
import { NextResponse, type NextRequest } from "next/server"
import i18nConfig from "./i18nConfig"
export const runtime = 'nodejs'

export async function middleware(request: NextRequest) {
  // ۱. مدیریت مسیرهای زبان (i18n)
  const i18nResult = i18nRouter(request, i18nConfig)
  if (i18nResult) return i18nResult

  try {
    const { supabase, response } = createClient(request)
    const { data: { session } } = await supabase.auth.getSession()

    const pathname = request.nextUrl.pathname

    // لیست صفحات عمومی که نیازی به لاگین ندارند
    const publicPaths = ["/login", "/setup", "/auth/callback"]

    // ۲. منطق جدید: محافظت از مسیرها
    // اگر کاربر لاگین نکرده و به صفحه‌ای غیر از صفحات عمومی می‌رود
    if (!session && !publicPaths.some(path => pathname.includes(path))) {
      // او را به صفحه لاگین هدایت کن
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // ۳. منطق قبلی شما: هدایت کاربر لاگین کرده از صفحه اصلی به چت
    if (session && pathname === "/") {
      const { data: homeWorkspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("is_home", true)
        .single()

      if (homeWorkspace) {
        return NextResponse.redirect(
          new URL(`/${homeWorkspace.id}/chat`, request.url)
        )
      }
    }

    return response
  } catch (e) {
    return NextResponse.next({
      request: {
        headers: request.headers
      }
    })
  }
}

export const config = {
  matcher: "/((?!api|static|.*\\..*|_next|auth/confirm|favicon.ico).*)",
}