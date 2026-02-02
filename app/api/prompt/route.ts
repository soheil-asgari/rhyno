import { MODEL_PROMPTS } from "@/lib/build-prompt"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    // برگرداندن کامل مدل‌ها و پرامپت‌ها
    return NextResponse.json(MODEL_PROMPTS)
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
