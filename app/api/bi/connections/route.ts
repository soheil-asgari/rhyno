// app/api/bi/connections/route.ts
import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import CryptoJS from "crypto-js"

export const dynamic = "force-dynamic"
const SECRET_KEY = process.env.DATA_ENCRYPTION_KEY || "my-secret-key-123"

export async function GET(req: Request) {
  console.log("📡 GET /api/bi/connections: Request received")
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get("workspaceId")

  if (!workspaceId) {
    console.log("❌ GET Error: Missing workspaceId")
    return NextResponse.json([], { status: 400 })
  }

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase
    .from("workspace_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("❌ Supabase Select Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`✅ GET Success: Found ${data?.length || 0} connections`)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  console.log("📥 POST /api/bi/connections: Starting save process...")
  try {
    const body = await req.json()
    const {
      workspaceId,
      name,
      type,
      host,
      port,
      username,
      password,
      database
    } = body

    console.log("📝 Payload:", {
      workspaceId,
      type,
      host,
      port,
      username,
      db: database
    })

    if (!workspaceId || !host || !username || !password) {
      console.log("❌ Validation Error: Missing fields")
      return NextResponse.json({ error: "اطلاعات ناقص است" }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    // رمزنگاری
    let encryptedPassword = ""
    try {
      encryptedPassword = CryptoJS.AES.encrypt(password, SECRET_KEY).toString()
    } catch (encErr) {
      console.error("❌ Encryption Error:", encErr)
      return NextResponse.json({ error: "Encryption failed" }, { status: 500 })
    }

    console.log("🔐 Password encrypted. Inserting to DB...")

    const { data, error } = await supabase
      .from("workspace_connections")
      .insert({
        workspace_id: workspaceId,
        db_type: type,
        host: host,
        port: parseInt(port),
        username: username,
        encrypted_password: encryptedPassword,
        database_name: database
        // name: name // اگر ستون name ندارید این را کامنت کنید
      })
      .select()
      .single()

    if (error) {
      console.error("❌ Supabase Insert Error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("✅ Insert Success:", data)
    return NextResponse.json(data)
  } catch (e: any) {
    console.error("❌ Unhandled API Error:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  console.log("🗑️ DELETE /api/bi/connections: Request received")
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")

  if (!id)
    return NextResponse.json({ error: "ID is required" }, { status: 400 })

  const cookieStore = cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase
    .from("workspace_connections")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("❌ Delete Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("✅ Delete Success for ID:", id)
  return NextResponse.json({ success: true })
}
