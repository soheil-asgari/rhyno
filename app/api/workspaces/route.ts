// app/api/workspaces/route.ts
import { NextResponse } from "next/server"
import {
  getHomeWorkspaceByUserId,
  getWorkspaceById,
  getWorkspacesByUserId,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace
} from "@/db/workspaces.server" // <-- سرور
// مسیر فایل سرور شما
import { supabase } from "@/lib/supabase/server-client"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get("userId")
    const workspaceId = url.searchParams.get("workspaceId")

    if (userId) {
      const workspaces = await getWorkspacesByUserId(userId)
      return NextResponse.json(workspaces)
    }

    if (workspaceId) {
      const workspace = await getWorkspaceById(workspaceId)
      return NextResponse.json(workspace)
    }

    return NextResponse.json(
      { message: "No parameters provided" },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const createdWorkspace = await createWorkspace(body)
    return NextResponse.json(createdWorkspace)
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { workspaceId, updates } = body
    if (!workspaceId || !updates) {
      return NextResponse.json(
        { message: "workspaceId and updates required" },
        { status: 400 }
      )
    }
    const updatedWorkspace = await updateWorkspace(workspaceId, updates)
    return NextResponse.json(updatedWorkspace)
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const workspaceId = url.searchParams.get("workspaceId")
    if (!workspaceId) {
      return NextResponse.json(
        { message: "workspaceId required" },
        { status: 400 }
      )
    }
    await deleteWorkspace(workspaceId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
