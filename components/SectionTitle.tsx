"use client"

import { memo } from "react"

const SectionTitle = memo(({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-8 text-center text-3xl font-bold text-white sm:text-4xl">
    {children}
  </h2>
))
SectionTitle.displayName = "SectionTitle"

export default SectionTitle
