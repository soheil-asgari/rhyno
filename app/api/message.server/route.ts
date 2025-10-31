// app/api/messages/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getMessageById,
  getMessagesByChatId,
  createMessage,
  createMessages,
  updateMessage,
  deleteMessage,
  deleteMessagesIncludingAndAfter
} from "@/db/messages" // فایل توابع بالا

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get("id")

  if (messageId) {
    try {
      const message = await getMessageById(messageId)
      return NextResponse.json(message)
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
  }

  const chatId = searchParams.get("chat_id")
  if (chatId) {
    const messages = await getMessagesByChatId(chatId)
    return NextResponse.json(messages)
  }

  return NextResponse.json({ error: "No query provided" }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  if (Array.isArray(body)) {
    const createdMessages = await createMessages(body)
    return NextResponse.json(createdMessages)
  } else {
    const createdMessage = await createMessage(body)
    return NextResponse.json(createdMessage)
  }
}

export async function PUT(request: NextRequest) {
  const { id, ...message } = await request.json()
  if (!id)
    return NextResponse.json({ error: "ID is required" }, { status: 400 })

  const updatedMessage = await updateMessage(id, message)
  return NextResponse.json(updatedMessage)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get("id")
  if (!messageId)
    return NextResponse.json({ error: "ID is required" }, { status: 400 })

  await deleteMessage(messageId)
  return NextResponse.json({ success: true })
}
