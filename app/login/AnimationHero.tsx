"use client"

import React from "react"
import Lottie from "lottie-react"
import roboticsAnimation from "@/public/animations/login1.json"

export default function AnimationHero() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Lottie
        animationData={roboticsAnimation}
        loop
        autoplay
        className="h-auto w-full"
      />
    </div>
  )
}
