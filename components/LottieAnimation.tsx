"use client"
import { useState, useEffect, CSSProperties } from "react"
import Lottie from "lottie-react"

// Define a type for the animation data for better type safety
type AnimationData = object | null

export default function LottieAnimation() {
  const [animationData, setAnimationData] = useState<AnimationData>(null)

  useEffect(() => {
    // Fetch the animation file after the initial page load
    // This prevents the large JSON from blocking the initial render
    fetch("/animations/robotics.json")
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok")
        }
        return response.json()
      })
      .then(data => setAnimationData(data))
      .catch(error => console.error("Failed to load animation:", error))
  }, []) // The empty dependency array ensures this runs only once

  // Define styles here to be reused
  const placeholderStyle: CSSProperties = {
    width: "100%",
    maxWidth: 800,
    height: 400, // Give it a fixed height to prevent layout shift
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "16px"
  }

  // Show a placeholder while the animation is loading
  if (!animationData) {
    return (
      <div style={placeholderStyle}>
        <p className="text-gray-500">درحال بارگذاری انیمیشن...</p>
      </div>
    )
  }

  // Render the Lottie component once data is available
  const lottieStyle: CSSProperties = {
    width: "100%",
    maxWidth: 800,
    height: "auto",
    margin: "0 auto"
  }

  // The error was here: style={{ ... }} is not valid syntax.
  // It has been replaced with the correct style object.
  return (
    <Lottie animationData={animationData} loop autoplay style={lottieStyle} />
  )
}
