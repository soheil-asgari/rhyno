import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { message: "کد تخفیف ارسال نشده است." },
        { status: 400 }
      )
    }

    const cookieStore = cookies()
    const supabase = createSSRClient(cookieStore)

    // ۱. استخراج شناسه کاربر (User ID)
    const { data: userData, error: userAuthError } =
      await supabase.auth.getUser()

    if (userAuthError || !userData.user) {
      return NextResponse.json(
        { message: "برای استفاده از کد تخفیف باید وارد حساب کاربری خود شوید." },
        { status: 401 }
      )
    }
    const userId = userData.user.id // شناسه کاربری فعلی
    // ------------------------------------

    // ۲. بررسی وجود و اعتبار کد تخفیف
    const { data: codeData, error: codeError } = await supabase
      .from("discount_codes")
      .select("id, is_active, expires_at, percentage") // 'id' کد تخفیف برای چک کردن سوابق استفاده لازم است
      .eq("code", code)
      .single()

    if (codeError || !codeData) {
      return NextResponse.json(
        { message: "کد تخفیف نامعتبر است." },
        { status: 404 }
      )
    }

    // بررسی فعال بودن و انقضا (منطق قبلی شما)
    if (
      !codeData.is_active ||
      (codeData.expires_at && new Date(codeData.expires_at) < new Date())
    ) {
      return NextResponse.json(
        { message: "این کد تخفیف فعال یا معتبر نیست." },
        { status: 403 }
      )
    }

    // ۳. بررسی سابقه استفاده کاربر از این کد
    // فرض بر این است که جدولی به نام `user_discount_usages` دارید.
    const { count: usageCount, error: usageError } = await supabase
      .from("user_discount_usages")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .eq("discount_code_id", codeData.id)
      .limit(1)

    if (usageError) {
      console.error("Usage check error:", usageError)
      return NextResponse.json(
        { message: "خطای دیتابیس در بررسی سابقه استفاده." },
        { status: 500 }
      )
    }

    if (usageCount && usageCount > 0) {
      return NextResponse.json(
        {
          message:
            "شما قبلاً از این کد تخفیف استفاده کرده‌اید. (مجاز به استفاده مجدد نیستید)"
        },
        { status: 403 }
      )
    }
    // ------------------------------------

    // ۴. بازگرداندن درصد تخفیف در صورت موفقیت
    return NextResponse.json({
      message: "کد تخفیف با موفقیت اعمال شد.",
      percentage: codeData.percentage,
      discount_id: codeData.id // ارسال ID تخفیف برای ثبت استفاده پس از پرداخت
    })
  } catch (error) {
    console.error("Discount validation error:", error)
    return NextResponse.json({ message: "خطای داخلی سرور." }, { status: 500 })
  }
}
