import { IconQuestionMark } from "@tabler/icons-react"
import Link from "next/link"
import { FC } from "react"

interface ChatHelpProps {}

export const ChatHelp: FC<ChatHelpProps> = ({}) => {
  return (
    // کامپوننت Link دور آیکون قرار می‌گیرد
    <Link href="/help" aria-label="Help Page">
      <IconQuestionMark className="bg-primary text-secondary size-[24px] cursor-pointer rounded-full p-0.5 opacity-60 hover:opacity-50 lg:size-[30px] lg:p-1" />
    </Link>
  )
}
