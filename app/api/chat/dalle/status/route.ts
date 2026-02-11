// File: app/api/chat/dalle/status/route.ts (نسخه نهایی با Supabase)

import { createClient as createSSRClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get("jobId")

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
  }

  try {
    const cookieStore = cookies()
    const supabase = createSSRClient(cookieStore)

    const { data: jobData, error } = await supabase
      .from("dalle_jobs")
      .select("status, image_url, error_message")
      .eq("id", jobId)
      .single()

    if (error) throw error

    if (!jobData) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json(jobData, { status: 200 })
  } catch (error: any) {
    console.error("Error fetching job status from Supabase:", error)
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    )
  }
}
