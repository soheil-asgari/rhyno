"use client"

import Image from "next/image"

export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-8 text-center">
      <div className="container mx-auto flex flex-col items-center justify-center gap-4 px-4 sm:flex-row">
        <p className="text-sm text-gray-500">
          &copy; {new Date().getFullYear()}. تمامی حقوق محفوظ است.
        </p>
        <a
          referrerPolicy="origin"
          target="_blank"
          rel="noopener noreferrer"
          href="https://trustseal.enamad.ir/?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT"
        >
          <Image
            referrerPolicy="origin"
            src="https://trustseal.enamad.ir/logo.aspx?id=642420&Code=snXTJxUEZgVAphAqD5lpep29PJRZ2haT"
            alt="نماد اعتماد الکترونیکی"
            width={125}
            height={125}
            className="h-12 cursor-pointer"
            unoptimized
          />
        </a>
      </div>
    </footer>
  )
}
