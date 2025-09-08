"use client"

import { supabase } from "@/lib/supabase/browser-client"
import { Tables } from "@/supabase/types"
import {
  IconArrowLeft,
  IconCheck,
  IconCreditCard,
  IconMail,
  IconPhone,
  IconReceipt,
  IconUser
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
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

const DepositHistory: React.FC<{ userId: string }> = ({ userId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("transactions" as any)
        .select("*")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5)

      if (error) {
        console.error("Error fetching transactions:", error)
      } else {
        // ✨ راه حل نهایی: نادیده گرفتن اجباری خطای تایپ‌اسکریپت
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
              + {(tx.amount / 10).toLocaleString("fa-IR")} تومان
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

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [chargeAmount, setChargeAmount] = useState("")

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
          // ✨ راه حل نهایی: نادیده گرفتن اجباری خطای تایپ‌اسکریپت
          // @ts-ignore
          setWallet(walletData)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

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
        body: JSON.stringify({ amountToman })
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
    console.log("✅ [Debug] Step 3: Formatting balance.")
    console.log("  - Input balance (USD):", balanceUSD, typeof balanceUSD)
    console.log("  - Exchange Rate:", MANUAL_EXCHANGE_RATE)
    const balanceIRR = balanceUSD * MANUAL_EXCHANGE_RATE
    const balanceToman = balanceIRR / 10
    const rounded = Math.floor(balanceToman)
    return rounded.toLocaleString("fa-IR")
  }

  const chargePresets = [200000, 1000000, 2000000]

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
            onClick={() => router.back()}
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
                  مبلغ مورد نظر را برای شارژ حساب انتخاب یا وارد کنید (به
                  تومان).
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
                {wallet && (
                  <div className="mt-2 text-xs text-blue-200">
                    {/* (<span className="font-mono">${wallet.balance.toFixed(2)}</span>) */}
                  </div>
                )}
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
          </div>
        </div>
      </div>
    </div>
  )
}
