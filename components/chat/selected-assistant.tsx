import Image from "next/image"
import { useContext } from "react"
import { ChatbotUIContext } from "@/context/context"

export const SelectedAssistant = () => {
  const { selectedAssistant, assistantImages } = useContext(ChatbotUIContext)
  if (!selectedAssistant) return null

  return (
    <div className="border-primary mx-auto flex w-fit items-center space-x-2 rounded-lg border p-1.5">
      {selectedAssistant.image_path && (
        <Image
          className="rounded"
          src={
            assistantImages.find(
              Image => Image.path === selectedAssistant.image_path
            )?.base64
          }
          width={28}
          height={28}
          alt={selectedAssistant.name}
        />
      )}
      <div className="text-sm font-bold">
        Talking to {selectedAssistant.name}
      </div>
    </div>
  )
}
