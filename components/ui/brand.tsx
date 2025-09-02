"use client"

import Link from "next/link"
import Image from "next/image"
import { FC } from "react"

interface BrandProps {
  theme?: "dark" | "light"
}

export const Brand: FC<BrandProps> = ({ theme = "dark" }) => {
  return (
    <Link
      className="flex cursor-pointer flex-col items-center hover:opacity-50"
      href="https://www.rhynochat.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="mb-2">
        <Image
          src="/rhyno1.png"
          width={120}
          height={120}
          alt="Rhyno Logo"
          className="rounded-full object-cover shadow-md transition-transform duration-200 hover:scale-105"
        />
      </div>

      <div className="text-4xl font-bold tracking-wide">Rhyno Chat</div>
    </Link>
  )
}
