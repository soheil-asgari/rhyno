import { Tables } from "@/supabase/types"
import { ChatFile } from "./chat-file"
export interface ChatMessage {
  message: Tables<"messages"> & { attachments?: ChatFile[] }
  fileItems: string[]
}
