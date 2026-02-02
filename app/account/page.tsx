"use client"

import { supabase } from "@/lib/supabase/browser-client" // ✨ خطا: مسیر ایمپورت اصلاح شد
import { Tables } from "@/supabase/types"
import {
  IconArrowLeft,
  IconCheck,
  IconCircleCheck,
  IconCreditCard,
  IconMail,
  IconPhone,
  IconReceipt,
  IconTicket,
  IconUser,
  IconChartPie,
  IconSum,
  IconCoin
} from "@tabler/icons-react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import type { User } from "@supabase/supabase-js"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

type Wallet = Tables<"wallets">
type Transaction = Tables<"transactions">

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "gpt-3.5-turbo": "💨 Rhyno V1",
  "gpt-3.5-turbo-16k": "💨 Rhyno V1 Pro",
  "gpt-4": "🧠 Rhyno V4",
  "gpt-4-turbo": "⚡ Rhyno V4 Turbo",
  "gpt-4-turbo-preview": "⚡ Rhyno V4 Preview",
  "gpt-4o": "🚀 Rhyno V4 Ultra",
  "gpt-4o-mini": "⚡ Rhyno V4 Mini",
  "computer-use-preview": "🖥️ Rhyno Auto", // ✅ اضافه شد
  "gpt-5": "🌌 Rhyno V5 Ultra",
  "gpt-5-mini": "✨ Rhyno V5 Mini",
  "gpt-5-nano": "🔹 Rhyno V5 Nano",
  "gpt-realtime": "🎙️ Rhyno Live V1",
  "gpt-realtime-mini": "🎧 Rhyno Live Mini",
  "dall-e-3": "🎨 Rhyno Image V1",
  "google/gemini-3-pro-image-preview": "🎨 Rhyno Image V2",
  "gpt-5-codex": "💻 Rhyno Code V1"
}
const formatToken = (num: number) => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + " M" // میلیون
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + " K" // هزار
  }
  return num.toString()
}

interface ModelUsage {
  model_name: string
  total_prompt_tokens: number
  total_completion_tokens: number
  total_cost_usd: number // <-- فیلد هزینه اضافه شد
}

// این ثابت را از کامپوننت اصلی کپی می‌کنیم تا اینجا در دسترس باشد

// تابع جدید برای تبدیل هزینه دلاری به تومان (با دقت اعشار)
const formatCostToToman = (costUSD: number) => {
  if (!costUSD || costUSD === 0) return "۰"

  const balanceIRR = costUSD * MANUAL_EXCHANGE_RATE
  const balanceToman = balanceIRR / 10

  // برای هزینه‌های کمتر از ۱ تومان، ۲ رقم اعشار نشان بده
  if (balanceToman < 1) {
    return balanceToman.toFixed(2)
  }
  // برای هزینه‌های کمتر از ۱۰۰ تومان، ۱ رقم اعشار نشان بده
  if (balanceToman < 100) {
    return balanceToman.toLocaleString("fa-IR", { maximumFractionDigits: 1 })
  }
  // برای هزینه‌های بالاتر، گرد کن
  return balanceToman.toLocaleString("fa-IR", { maximumFractionDigits: 0 })
}

const UsageHistory: React.FC<{ userId: string }> = ({ userId }) => {
  const [usage, setUsage] = useState<ModelUsage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true)

      // اگر از 'as any' استفاده می‌کنید، آن را نگه دارید
      const { data, error } = await supabase.rpc(
        "get_user_model_usage" as any,
        {
          p_user_id: userId
        }
      )

      if (error) {
        console.error("Error fetching model usage:", error)
        toast.error("خطا در دریافت تاریخچه مصرف")
      } else {
        // اگر از 'as ModelUsage[]' استفاده می‌کنید، آن را نگه دارید
        setUsage((data as ModelUsage[]) || [])
      }
      setLoading(false)
    }
    fetchUsage()
  }, [userId])

  if (loading) {
    // ... (بخش لودینگ بدون تغییر) ...
  }

  return (
    <div className="mt-4 space-y-4">
      {usage.length > 0 ? (
        usage.map(item => (
          <div
            key={item.model_name}
            className="font-vazir border-b pb-3 text-sm last:border-b-0"
          >
            <p className="text-base font-semibold">
              {MODEL_DISPLAY_NAMES[item.model_name] || item.model_name}
            </p>
            <div className="text-muted-foreground mt-2 flex justify-between">
              <span>توکن‌های ورودی (Prompt):</span>
              <span className="font-vazir text-foreground font-medium">
                {formatToken(item.total_prompt_tokens)}
              </span>
            </div>
            <div className="font-vazir text-muted-foreground flex justify-between">
              <span>توکن‌های خروجی (Completion):</span>
              <span className="font-vazir text-foreground font-medium">
                {formatToken(item.total_completion_tokens)}
              </span>
            </div>

            <div className="mt-2 space-y-1 border-t border-dashed border-gray-700 pt-2">
              {/* مجموع توکن‌ها */}
              <div className="flex items-center justify-between">
                <span className="text-foreground flex items-center text-sm font-semibold">
                  <IconSum size={14} className="ml-1 text-blue-400" />
                  مجموع توکن‌ها
                </span>
                <span className="font-mono font-bold text-blue-300">
                  {formatToken(
                    item.total_prompt_tokens + item.total_completion_tokens
                  )}
                </span>
              </div>

              {/* هزینه کل */}
              <div className="flex items-center justify-between">
                <span className="text-foreground flex items-center text-sm font-semibold">
                  <IconCoin size={14} className="ml-1 text-yellow-500" />
                  هزینه کل
                </span>
                <span className="font-vazir font-bold text-yellow-400">
                  {formatCostToToman(item.total_cost_usd)} تومان
                </span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="font-vazir text-muted-foreground py-4 text-center text-sm">
          تاریخچه مصرفی برای نمایش وجود ندارد.
        </p>
      )}
    </div>
  )
}
// --- کامپوننت تاریخچه واریز (بدون تغییر) ---
const DepositHistory: React.FC<{ userId: string }> = ({ userId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) {
        console.error("Error fetching transactions:", error)
      } else {
        // @ts-ignore
        setTransactions(data || [])
      }
      setLoading(false)
    }
    fetchTransactions()
  }, [userId])

  if (loading) {
    return (
      <div className="mt-2 space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      {transactions.length > 0 ? (
        transactions.map(tx => (
          <div
            key={tx.id}
            className="font-vazir flex items-center justify-between border-b pb-2 text-sm last:border-b-0"
          >
            <div>
              <p className="flex items-center font-semibold">
                <IconCheck size={16} className="ml-2 text-green-500" />
                شارژ موفق
              </p>
              <p className="text-muted-foreground text-xs">
                {new Date(tx.created_at).toLocaleString("fa-IR")}
              </p>
            </div>
            <p className="font-vazir font-semibold text-green-500">
              + {(tx.amount_irr / 10).toLocaleString("fa-IR")} تومان
            </p>
          </div>
        ))
      ) : (
        <p className="font-vazir text-muted-foreground py-4 text-center text-sm">
          تاریخچه واریزی وجود ندارد
        </p>
      )}
    </div>
  )
}

const MANUAL_EXCHANGE_RATE = 1030000

function AccountPageComponent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [chargeAmount, setChargeAmount] = useState("")
  const [discountCode, setDiscountCode] = useState("")
  const [isApplyingCode, setIsApplyingCode] = useState(false)
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string
    percentage: number
  } | null>(null)

  useEffect(() => {
    const status = searchParams.get("status")
    const trackId = searchParams.get("track_id")

    if (status === "success") {
      toast.success(`پرداخت با موفقیت انجام شد. کد رهگیری: ${trackId}`)
      router.replace("/account", undefined)
    } else if (status === "failed") {
      toast.error(
        `پرداخت ناموفق بود. در صورت کسر وجه، مبلغ تا ۷۲ ساعت آینده به حساب شما بازگردانده می‌شود.`
      )
      router.replace("/account", undefined)
    }
  }, [searchParams, router])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const {
        data: { user }
      } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: walletData, error } = await supabase
          .from("wallets" as any)
          .select("*")
          .eq("user_id", user.id)
          .single()

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching wallet:", error)
        } else {
          // @ts-ignore
          setWallet(walletData)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleApplyCode = async () => {
    if (!discountCode) {
      toast.error("لطفا کد تخفیف را وارد کنید.")
      return
    }
    setIsApplyingCode(true)
    try {
      const response = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: discountCode })
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "کد تخفیف نامعتبر است.")
      }

      setAppliedDiscount({
        code: discountCode,
        percentage: data.percentage
      })
      toast.success(`کد تخفیف ${data.percentage}% با موفقیت اعمال شد!`)
    } catch (error: any) {
      setAppliedDiscount(null)
      toast.error(error.message)
    } finally {
      setIsApplyingCode(false)
    }
  }

  const handleCharge = async () => {
    const amountToman = parseInt(chargeAmount, 10)
    if (isNaN(amountToman) || amountToman < 100000) {
      toast.error("حداقل مبلغ شارژ ۱۰۰,۰۰۰ تومان می‌باشد.")
      return
    }

    try {
      const response = await fetch("/api/payment/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountToman,
          discountCode: appliedDiscount ? appliedDiscount.code : null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "خطا در سرور")
      }

      if (data.paymentLink) {
        window.location.href = data.paymentLink
      }
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const formatBalance = (balanceUSD: number) => {
    const balanceIRR = balanceUSD * MANUAL_EXCHANGE_RATE
    const balanceToman = balanceIRR / 10
    const rounded = Math.floor(balanceToman)
    return rounded.toLocaleString("fa-IR")
  }

  const chargePresets = [100000, 200000, 500000]

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4 sm:p-8">
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }
  if (!user) {
    return <div>...</div>
  }

  return (
    <div className="bg-muted/20 flex w-full justify-center p-4 sm:p-8 dark:bg-black">
      <div className="animate-in fade-in-50 w-full max-w-4xl space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-vazir text-3xl font-bold tracking-tight">
            پنل کاربری
          </h1>
          <Button
            variant="ghost"
            onClick={() => router.push("/login")}
            className="font-vazir mt-2 self-start sm:mt-0 sm:self-center"
          >
            <IconArrowLeft size={20} className="ml-2 rtl:ml-0 rtl:mr-2" />{" "}
            بازگشت
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
          <div className="font-vazir space-y-8 md:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>افزایش اعتبار</CardTitle>
                <CardDescription>
                  مبلغ مورد نظر را برای شارژ حساب انتخاب یا وارد کنید.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {chargePresets.map(amount => (
                    <Button
                      key={amount}
                      variant={
                        chargeAmount === String(amount) ? "default" : "outline"
                      }
                      size="lg"
                      onClick={() => setChargeAmount(String(amount))}
                    >
                      {amount.toLocaleString("fa-IR")}
                    </Button>
                  ))}
                </div>
                <div className="relative">
                  <Input
                    id="charge-amount"
                    type="text"
                    dir="ltr"
                    className="h-12 text-center text-lg"
                    placeholder="یا مبلغ دلخواه به تومان"
                    value={
                      chargeAmount
                        ? parseInt(chargeAmount).toLocaleString()
                        : ""
                    }
                    onChange={e => {
                      const value = e.target.value.replace(/,/g, "")
                      if (!isNaN(Number(value)) || value === "")
                        setChargeAmount(value)
                    }}
                  />
                </div>
                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="discount-code">کد تخفیف دارید؟</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="discount-code"
                      placeholder="کد تخفیف را وارد کنید"
                      value={discountCode}
                      onChange={e => setDiscountCode(e.target.value)}
                      disabled={!!appliedDiscount}
                      className="h-11"
                    />
                    <Button
                      variant="outline"
                      onClick={handleApplyCode}
                      disabled={isApplyingCode || !!appliedDiscount} // ✨ اصلاح: غیرفعال کردن هنگام لودینگ
                      className="shrink-0"
                    >
                      {isApplyingCode ? "..." : "اعمال کد"}{" "}
                      {/* ✨ اصلاح: نمایش لودینگ */}
                    </Button>
                  </div>
                  {appliedDiscount && (
                    <p className="flex items-center text-sm text-green-600">
                      <IconCircleCheck size={16} className="ml-1" />
                      تخفیف {appliedDiscount.percentage}% اعمال شد.
                    </p>
                  )}
                </div>

                <Button
                  onClick={handleCharge}
                  className="font-vazir w-full"
                  size="lg"
                >
                  <IconCreditCard className="mr-2" />
                  پرداخت و شارژ نهایی
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-vazir flex items-center text-lg">
                  <IconChartPie size={20} className="ml-2" /> آمار مصرف مدل‌ها
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UsageHistory userId={user.id} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-vazir flex items-center text-lg">
                  <IconReceipt size={20} className="ml-2" /> تاریخچه ۵ واریز
                  اخیر
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DepositHistory userId={user.id} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8 md:col-span-2">
            <Card className="font-vazir overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-xl">
              <CardHeader>
                <CardTitle>موجودی حساب</CardTitle>
              </CardHeader>
              <CardContent className="p-8 text-center">
                <div className="font-vazir text-4xl font-bold tracking-tighter sm:text-6xl">
                  {wallet ? formatBalance(wallet.balance) : "۰"}
                </div>
                <div className="text-xl font-light sm:text-2xl">تومان</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="font-vazir flex items-center text-lg">
                  <IconUser
                    size={20}
                    className="font-vazir text-muted-foreground ml-3"
                  />
                  اطلاعات شما
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="font-vazir flex items-center">
                  <IconMail
                    size={16}
                    className="font-vazir text-muted-foreground ml-3"
                  />
                  <span className="break-all font-mono">{user.email}</span>
                </div>
                <div className="font-vazir flex items-center">
                  <IconPhone
                    size={16}
                    className="font-vazir text-muted-foreground ml-3"
                  />
                  <span className="font-mono">{user.phone || "ثبت نشده"}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="font-vazir flex h-20 items-center justify-center">
              <Button
                onClick={() => router.push("/tickets")}
                className="px-6 py-3"
                variant="default"
              >
                <IconTicket className="ml-2" />
                مشاهده تیکت‌ها
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AccountPageComponent />
    </Suspense>
  )
}
