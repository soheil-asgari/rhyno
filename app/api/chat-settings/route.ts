import { NextResponse } from "next/server"
import { CHAT_SETTING_LIMITS } from "@/lib/chat-setting-limits" // مسیر جدید

export async function GET(request: Request) {
  try {
    return NextResponse.json(CHAT_SETTING_LIMITS)
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
