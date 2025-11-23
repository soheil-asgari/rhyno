// app/(enterprise)/login/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/browser-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { FiLock, FiShield, FiArrowLeft } from "react-icons/fi"
import Link from "next/link"
import Image from "next/image"

export default function EnterpriseLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        toast.error("اطلاعات ورود اشتباه است یا دسترسی ندارید.")
        setLoading(false)
        return
      }

      // موفقیت: هدایت به صفحه پورتال برای مسیریابی هوشمند
      toast.success("خوش آمدید")
      router.push("/enterprise/portal")
    } catch (error) {
      toast.error("خطای سیستمی")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-white dark:bg-[#0f1018]">
      {/* بخش سمت راست - فرم ورود */}
      <div className="flex w-full flex-col justify-center p-8 md:w-1/2 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <div className="mb-6 flex items-center gap-2 text-blue-600">
              <FiShield size={40} />
              <span className="text-2xl font-bold tracking-tight">
                Rhyno Enterprise
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              ورود به پنل مدیریت
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              لطفاً اطلاعات حساب سازمانی خود را وارد کنید.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">ایمیل سازمانی</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-12 bg-gray-50 dark:bg-gray-900"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">رمز عبور</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-12 bg-gray-50 pl-10 dark:bg-gray-900"
                  required
                />
                <FiLock className="absolute left-3 top-3.5 text-gray-400" />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full bg-blue-600 text-lg hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "در حال اعتبارسنجی..." : "ورود امن"}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>مشکلی در ورود دارید؟ با پشتیبانی فنی تماس بگیرید.</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1 text-gray-400 hover:text-gray-600"
            >
              <FiArrowLeft /> بازگشت به صفحه اصلی سایت
            </Link>
          </div>
        </div>
      </div>

      {/* بخش سمت چپ - تصویر و برندینگ */}
      <div className="relative hidden w-1/2 overflow-hidden bg-slate-900 md:block">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-slate-900 opacity-90" />

        {/* اگر تصویری دارید در پوشه public بگذارید */}
        {/* <Image src="/images/enterprise-bg.jpg" alt="Enterprise" fill className="object-cover mix-blend-overlay" /> */}

        <div className="relative z-10 flex h-full flex-col items-center justify-center p-12 text-center text-white">
          <div className="mb-6 rounded-2xl bg-white/10 p-4 backdrop-blur-lg">
            {/* اینجا می‌توانید آیکون BI بگذارید */}
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <h2 className="mb-4 text-3xl font-bold">هوش تجاری پیشرفته</h2>
          <p className="max-w-md text-lg text-blue-100">
            داده‌های خام خود را به تصمیمات استراتژیک تبدیل کنید. امنیت بالا،
            سرعت بی‌نظیر و تحلیل‌های دقیق مبتنی بر هوش مصنوعی.
          </p>
        </div>
      </div>
    </div>
  )
}
