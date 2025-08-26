// مسیر فایل: app/[locale]/signup/page.tsx

"use client"

// ۱. ایمپورت کردن اکشن‌ها از فایل جدید
import { signUp, signInWithGoogle } from "@/app/actions"
import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { useState } from "react"

export default function SignupPage({
  searchParams
}: {
  searchParams: { message: string }
}) {
  const [showPassword, setShowPassword] = useState(false)

  // ۲. تمام توابع Server Action از اینجا حذف شده‌اند

  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form
        className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2"
        action={signUp} // ۳. استفاده از اکشن ایمپورت شده
      >
        <Brand />

        <Label className="text-md mt-4" htmlFor="email">
          Email
        </Label>
        <Input
          className="mb-3 rounded-md border bg-inherit px-4 py-2"
          name="email"
          placeholder="you@example.com"
          required
        />

        <Label className="text-md" htmlFor="password">
          Password
        </Label>
        <div className="relative mb-3">
          <Input
            className="w-full rounded-md border bg-inherit px-4 py-2"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-200"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <Label className="text-md" htmlFor="confirmPassword">
          Confirm Password
        </Label>
        <div className="relative mb-6">
          <Input
            className="w-full rounded-md border bg-inherit px-4 py-2"
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            placeholder="••••••••"
            required
          />
        </div>

        <SubmitButton
          formAction={signUp}
          className="mb-2 rounded-md bg-blue-700 px-4 py-2 text-white"
        >
          Sign Up
        </SubmitButton>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background text-muted-foreground px-2">Or</span>
          </div>
        </div>

        <SubmitButton
          formAction={signInWithGoogle}
          formNoValidate={true}
          className="border-foreground/20 flex items-center justify-center gap-2 rounded-md border px-4 py-2"
        >
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            ></path>
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            ></path>
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            ></path>
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            ></path>
            <path d="M1 1h22v22H1z" fill="none"></path>
          </svg>
          Sign Up with Google
        </SubmitButton>

        <div className="text-muted-foreground mt-4 flex justify-center text-sm">
          <span className="mr-1">Already have an account?</span>
          <a
            href="/login"
            className="text-primary ml-1 underline hover:opacity-80"
          >
            Log In
          </a>
        </div>

        {searchParams?.message && (
          <p className="bg-foreground/10 text-foreground mt-4 p-4 text-center">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}
