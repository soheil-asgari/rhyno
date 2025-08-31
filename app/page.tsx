"use client"

import { IconArrowRight } from "@tabler/icons-react"
import Link from "next/link"
import { redirect } from "next/navigation"
export default function HomePage() {
  redirect("/landing") // مسیر دلخواهت
}
