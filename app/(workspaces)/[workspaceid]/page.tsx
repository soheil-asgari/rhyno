"use client"

import { ChatbotUIContext } from "@/context/context"
import { useContext } from "react"
import { useRouter } from "next/navigation"

export default function WorkspacePage({
  params
}: {
  params: { workspaceid: string }
}) {
  const { selectedWorkspace } = useContext(ChatbotUIContext)
  const router = useRouter()

  // console.log("WorkspacePage: params:", params)
  // console.log(
  //   "WorkspacePage: selectedWorkspace:",
  //   JSON.stringify(selectedWorkspace, null, 2)
  // )

  // ریدایرکت به /chat اگر selectedWorkspace وجود ندارد
  if (!selectedWorkspace) {
    // console.log(
    //   "WorkspacePage: No selectedWorkspace, redirecting to /:workspaceid/chat"
    // )
    router.push(`/${params.workspaceid}/chat`)
    return null
  }

  // اعتبارسنجی نام workspace
  const workspaceName =
    selectedWorkspace.name && typeof selectedWorkspace.name === "string"
      ? selectedWorkspace.name
      : "Workspace بدون نام"

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <div className="text-4xl">{workspaceName}</div>
    </div>
  )
}
