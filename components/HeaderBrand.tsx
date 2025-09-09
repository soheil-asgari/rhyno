"use client"

import Image from "next/image"

export default function HeaderBrand() {
  return (
    <div className="flex items-center space-x-2 rtl:space-x-reverse">
      <Image
        src="/rhyno1.png"
        width={40}
        height={40}
        priority
        alt="Rhyno Logo"
        className="rounded-full object-cover"
      />
      <span className="text-xl font-semibold text-white">Rhyno AI</span>
    </div>
  )
}
