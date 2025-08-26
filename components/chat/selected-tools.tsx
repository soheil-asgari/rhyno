import { useContext } from "react"
import { ChatbotUIContext } from "@/context/context"
import { IconBolt } from "@tabler/icons-react"

export const SelectedTools = () => {
  const { selectedTools, setSelectedTools } = useContext(ChatbotUIContext)

  return (
    <>
      {selectedTools.map(tool => (
        <div
          key={tool.id}
          className="flex justify-center"
          onClick={() =>
            setSelectedTools(prev => prev.filter(t => t.id !== tool.id))
          }
        >
          <div className="flex cursor-pointer items-center justify-center space-x-1 rounded-lg bg-purple-600 px-3 py-1 hover:opacity-50">
            <IconBolt size={20} />
            <div>{tool.name}</div>
          </div>
        </div>
      ))}
    </>
  )
}
