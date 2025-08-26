import { FC } from "react"

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
    <img
      className={className}
      src={imageUrl}
      alt="OpenAI Image"
      width={width}
      height={height}
    />
  )
}
