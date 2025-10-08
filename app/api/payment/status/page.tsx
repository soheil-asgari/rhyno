"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  IconAlertCircle,
  IconCircleCheck,
  IconLoader2
} from "@tabler/icons-react"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function PaymentStatusComponent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "failed">(
    "loading"
  )
  const [details, setDetails] = useState({
    trackId: "",
    amount: "",
    message: ""
  })

  useEffect(() => {
    const paymentStatus = searchParams.get("status")
    const trackId = searchParams.get("track_id") || ""
    const amount = searchParams.get("amount") || ""
    const message = searchParams.get("message") || ""

    if (paymentStatus === "success") {
      setStatus("success")
      setDetails({ trackId, amount, message: "پرداخت شما با موفقیت ثبت شد." })
    } else {
      setStatus("failed")
      setDetails({
        trackId: trackId,
        amount: amount,
        message:
          message ||
          "پرداخت ناموفق بود. در صورت کسر وجه، مبلغ طی ۷۲ ساعت آینده به حساب شما بازگردانده می‌شود."
      })
    }
  }, [searchParams])

  const StatusDisplay = () => {
    if (status === "loading") {
      return (
        <div className="flex flex-col items-center justify-center text-center">
          <IconLoader2 className="size-16 animate-spin text-gray-400" />
          <p className="font-vazir mt-4 text-lg">
            در حال بررسی وضعیت پرداخت...
          </p>
        </div>
      )
    }

    if (status === "success") {
      return (
        <div className="flex flex-col items-center justify-center text-center">
          <IconCircleCheck className="size-20 text-green-500" />
          <h2 className="font-vazir mt-4 text-2xl font-bold">پرداخت موفق</h2>
          <p className="text-muted-foreground mt-2">{details.message}</p>
        </div>
      )
    }

    return (
      // status === "failed"
      <div className="flex flex-col items-center justify-center text-center">
        <IconAlertCircle className="size-20 text-red-500" />
        <h2 className="font-vazir mt-4 text-2xl font-bold">پرداخت ناموفق</h2>
        <p className="text-muted-foreground mt-2 max-w-sm">{details.message}</p>
      </div>
    )
  }

  return (
    <div className="font-vazir flex min-h-screen w-full items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <Card className="animate-in fade-in-50 w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl">نتیجه تراکنش</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[200px] items-center justify-center">
          <StatusDisplay />
        </CardContent>
        {(details.trackId || details.amount) && (
          <CardFooter className="flex flex-col gap-2 border-t pt-4">
            {details.amount && (
              <div className="text-muted-foreground flex w-full justify-between text-sm">
                <span>مبلغ:</span>
                <span className="font-semibold">
                  {Number(details.amount).toLocaleString("fa-IR")} تومان
                </span>
              </div>
            )}
            {details.trackId && (
              <div className="text-muted-foreground flex w-full justify-between text-sm">
                <span>کد رهگیری:</span>
                <span className="font-mono">{details.trackId}</span>
              </div>
            )}
          </CardFooter>
        )}
        <div className="p-6 pt-2">
          <Button asChild className="w-full">
            <Link href="/account">بازگشت به پنل کاربری</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default function PaymentStatusPage() {
  return (
    <Suspense fallback={<div>Loading status...</div>}>
      <PaymentStatusComponent />
    </Suspense>
  )
}
