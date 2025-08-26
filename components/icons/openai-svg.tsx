import { FC } from "react"
import Image from "next/image"
interface OpenAIImageProps {
  height?: number
  width?: number
  className?: string
  imageUrl: string
}

export const OpenAIImage: FC<OpenAIImageProps> = ({
  height = 40,
  width = 40,
  className,
  imageUrl = "/rhyno1.png"
}) => {
  return (
    <Image
      className={className}
      src={imageUrl}
      alt="OpenAI Image"
      priority
      width={width}
      height={height}
    />
  )
}
