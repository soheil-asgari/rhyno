// app/api/payment/route.ts

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/browser-client"

import { ServerRuntime } from "next"

export const runtime: ServerRuntime = "edge"

// ✨ نرخ ثابت دلار به ریال را اینجا تعریف کنید
const MANUAL_EXCHANGE_RATE = 1030000 // مثال: هر دلار ۱,۰۳۰,۰۰۰ ریال (۱۰۳ هزار تومان)

export async function POST(request: Request) {
  try {
    const { amountToman } = await request.json() // مبلغ را به تومان دریافت می‌کنیم
    const amountIRR = amountToman * 10 // تبدیل به ریال

    if (!amountIRR || amountIRR < 1000000) {
      // حداقل ۱۰۰ هزار تومان
      return NextResponse.json({ message: "مبلغ نامعتبر است" }, { status: 400 })
    }

    const {
      data: { user }
    } = await supabase.auth.getUser() // (این بخش نیاز به اصلاح دارد)
    if (!user) {
      return NextResponse.json({ message: "کاربر یافت نشد" }, { status: 401 })
    }

    // ✨ تبدیل مبلغ ریالی به دلار برای افزودن به کیف پول پس از پرداخت موفق
    const amountUSD = amountIRR / MANUAL_EXCHANGE_RATE

    // TODO: در اینجا باید به درگاه پرداخت متصل شوید
    // ۱. با مبلغ `amountIRR` یک لینک پرداخت بسازید.
    // ۲. پس از بازگشت موفق کاربر از درگاه، باید یک تابع دیگر داشته باشید که
    //    مبلغ `amountUSD` را به موجودی کاربر در جدول `wallets` اضافه کند.

    const paymentLink = `https://your-payment-gateway.com/pay/${amountIRR}` // لینک نمونه
    return NextResponse.json({ paymentLink })
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
