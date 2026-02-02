import { openapiToFunctions } from "@/lib/openapi-conversion"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Tables } from "@/supabase/types"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"
import { NextRequest, NextResponse } from "next/server"
import { ServerRuntime } from "next"
import { createClient } from "@supabase/supabase-js"

import jwt from "jsonwebtoken"

export const runtime: ServerRuntime = "nodejs"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { chatSettings, messages, selectedTools } = json as {
      chatSettings: ChatSettings
      messages: any[]
      selectedTools: Tables<"tools">[]
      userId: string
    }

    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new NextResponse("Unauthorized: Missing Bearer token", {
        status: 401
      })
    }
    const token = authHeader.split(" ")[1]

    let userId: string

    // ۱. اعتبارسنجی دستی توکن با JWT_SECRET
    try {
      if (!process.env.SUPABASE_JWT_SECRET) {
        throw new Error("SUPABASE_JWT_SECRET is not set on server!")
      }
      const decodedToken = jwt.verify(
        token,
        process.env.SUPABASE_JWT_SECRET
      ) as jwt.JwtPayload

      if (!decodedToken.sub) {
        throw new Error("Invalid token: No 'sub' (user ID) found.")
      }
      userId = decodedToken.sub // 'sub' همان User ID است
      console.log(`[Agent] ✅ Token MANUALLY verified! User ID: ${userId}`)
    } catch (err: any) {
      console.error("[Agent] ❌ Manual JWT Verification Failed:", err.message)
      return new NextResponse(
        `Unauthorized: Manual verification failed: ${err.message}`,
        { status: 401 }
      )
    }

    // ۲. ساخت کلاینت ادمین (Admin) برای گرفتن آبجکت کامل User
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on server!")
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const {
      data: { user },
      error: adminError
    } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (adminError || !user) {
      console.error(
        "[Agent] ❌ Admin client failed to get user:",
        adminError?.message
      )
      return new NextResponse(
        `Unauthorized: User not found with admin client: ${adminError?.message}`,
        { status: 401 }
      )
    }
    console.log(`[Agent] ✅ Full user object retrieved for: ${user.email}`)
    // ============================
    // پروفایل و API key
    // ============================
    const profile = await getServerProfile(userId, supabaseAdmin)
    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    // ============================
    // تبدیل schema ابزارها
    // ============================
    let allTools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
    let allRouteMaps = {}
    let schemaDetails = []

    for (const selectedTool of selectedTools) {
      try {
        const convertedSchema = await openapiToFunctions(
          JSON.parse(selectedTool.schema as string)
        )
        allTools = allTools.concat(convertedSchema.functions || [])
        const routeMap = convertedSchema.routes.reduce(
          (map: Record<string, string>, route) => {
            map[route.path.replace(/{(\w+)}/g, ":$1")] = route.operationId
            return map
          },
          {}
        )
        allRouteMaps = { ...allRouteMaps, ...routeMap }
        schemaDetails.push({
          title: convertedSchema.info.title,
          description: convertedSchema.info.description,
          url: convertedSchema.info.server,
          headers: selectedTool.custom_headers,
          routeMap,
          requestInBody: convertedSchema.routes[0].requestInBody
        })
      } catch (err: any) {
        console.error("Error converting schema", err)
      }
    }

    // ============================
    // تنظیم temperature
    // ============================
    const temp =
      typeof chatSettings.temperature === "number"
        ? chatSettings.temperature
        : [
              "gpt-4-vision-preview",
              "gpt-4o",
              "gpt-4o-mini",
              "gpt-5",
              "gpt-5-mini"
            ].includes(chatSettings.model)
          ? 1
          : 0.7

    // ============================
    // درخواست اول OpenAI
    // ============================
    const firstResponse = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages,
      temperature: temp,
      tools: allTools.length > 0 ? allTools : undefined
    })

    const message = firstResponse.choices[0].message
    messages.push(message)
    const toolCalls = message.tool_calls || []

    // ============================
    // اجرای ابزارها
    // ============================
    for (const toolCall of toolCalls) {
      const functionCall = (toolCall as any).function
      const functionName = functionCall.name
      const parsedArgs = JSON.parse(functionCall.arguments.trim())

      const schemaDetail = schemaDetails.find(detail =>
        Object.values(detail.routeMap).includes(functionName)
      )
      if (!schemaDetail) throw new Error(`Function ${functionName} not found`)

      const pathTemplate = Object.keys(schemaDetail.routeMap).find(
        key => schemaDetail.routeMap[key] === functionName
      )
      if (!pathTemplate)
        throw new Error(`Path for function ${functionName} not found`)

      const path = pathTemplate.replace(/:(\w+)/g, (_, paramName) => {
        const value = parsedArgs.parameters[paramName]
        if (!value) throw new Error(`Parameter ${paramName} not found`)
        return encodeURIComponent(value)
      })

      const isRequestInBody = schemaDetail.requestInBody
      let data = {}

      if (isRequestInBody) {
        let headers: Record<string, string> = {}

        if (schemaDetail.headers && typeof schemaDetail.headers === "string") {
          headers = JSON.parse(schemaDetail.headers) as Record<string, string>
        }

        const response = await fetch(schemaDetail.url + path, {
          method: "POST",
          headers,
          body: JSON.stringify(parsedArgs.requestBody || parsedArgs)
        })
        data = response.ok
          ? await response.json()
          : { error: response.statusText }
      } else {
        const queryParams = new URLSearchParams(
          parsedArgs.parameters
        ).toString()
        let headers: Record<string, string> = {}

        if (schemaDetail.headers && typeof schemaDetail.headers === "string") {
          headers = JSON.parse(schemaDetail.headers) as Record<string, string>
        }

        const response = await fetch(
          schemaDetail.url + path + (queryParams ? "?" + queryParams : ""),
          { method: "GET", headers }
        )
        data = response.ok
          ? await response.json()
          : { error: response.statusText }
      }

      messages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: functionName,
        content: JSON.stringify(data)
      })
    }

    // ============================
    // درخواست دوم OpenAI با استریم
    // ============================
    const secondResponse = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages,
      temperature: temp,
      stream: true
    })

    const stream = OpenAIStream(secondResponse as any) // موقتاً any برای رفع مشکل type
    return new StreamingTextResponse(stream)
  } catch (error: any) {
    console.error(error)
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
