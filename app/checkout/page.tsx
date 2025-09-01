"use client"

import React from "react"

export default function CheckoutPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-8 shadow-lg">
        <h1 className="mb-4 text-2xl font-bold">صفحه پرداخت</h1>
        <p className="mb-6 text-gray-400">
          اینجا می‌تونی اشتراکت رو تکمیل کنی 🚀
        </p>

        <form className="space-y-4">
          <input
            type="text"
            placeholder="نام و نام خانوادگی"
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-gray-500 focus:outline-none"
          />
          <input
            type="email"
            placeholder="ایمیل"
            className="w-full rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-white focus:border-gray-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-white px-4 py-2 font-bold text-black hover:bg-gray-200"
          >
            ادامه به پرداخت
          </button>
        </form>
      </div>
    </div>
  )
}
