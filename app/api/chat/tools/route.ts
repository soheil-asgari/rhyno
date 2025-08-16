import { openapiToFunctions } from "@/lib/openapi-conversion"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Tables } from "@/supabase/types"
import { ChatSettings } from "@/types"
import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { NextRequest } from "next/server"

export const runtime = "edge"

export async function POST(request: NextRequest) {
  const json = await request.json()
  const { chatSettings, messages, selectedTools } = json as {
    chatSettings: ChatSettings
    messages: any[]
    selectedTools: Tables<"tools">[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.openai_api_key, "OpenAI")

    // ایجاد کلاینت OpenAI با Vercel AI SDK
    const openaiClient = openai({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    let allTools: any[] = []
    let allRouteMaps = {}
    let schemaDetails: any[] = []

    // پردازش ابزارها و تبدیل schema
    for (const selectedTool of selectedTools) {
      try {
        const convertedSchema = await openapiToFunctions(
          JSON.parse(selectedTool.schema as string)
        )
        const tools = convertedSchema.functions || []
        allTools = allTools.concat(tools)

        const routeMap = convertedSchema.routes.reduce(
          (map: Record<string, string>, route: any) => {
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
      } catch (error: any) {
        console.error("Error converting schema", error)
      }
    }

    // اولین فراخوانی برای بررسی ابزارها
    const firstResponse = await streamText({
      model: openaiClient(chatSettings.model),
      messages,
      tools: allTools.length > 0 ? allTools : undefined
    })

    const result = await firstResponse.toDataStreamResponse()
    const message = (await result.json()).choices[0].message
    messages.push(message)
    const toolCalls = message.tool_calls || []

    if (toolCalls.length === 0) {
      return new Response(JSON.stringify({ content: message.content }), {
        headers: { "Content-Type": "application/json" }
      })
    }

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const functionCall = toolCall.function
        const functionName = functionCall.name
        const argumentsString = toolCall.function.arguments.trim()
        const parsedArgs = JSON.parse(argumentsString)

        // پیدا کردن schema مرتبط با ابزار
        const schemaDetail = schemaDetails.find(detail =>
          Object.values(detail.routeMap).includes(functionName)
        )

        if (!schemaDetail) {
          throw new Error(`Function ${functionName} not found in any schema`)
        }

        const pathTemplate = Object.keys(schemaDetail.routeMap).find(
          key => schemaDetail.routeMap[key] === functionName
        )

        if (!pathTemplate) {
          throw new Error(`Path for function ${functionName} not found`)
        }

        const path = pathTemplate.replace(/:(\w+)/g, (_, paramName) => {
          const value = parsedArgs.parameters[paramName]
          if (!value) {
            throw new Error(
              `Parameter ${paramName} not found for function ${functionName}`
            )
          }
          return encodeURIComponent(value)
        })

        if (!path) {
          throw new Error(`Path for function ${functionName} not found`)
        }

        // تعیین نوع درخواست (body یا query)
        const isRequestInBody = schemaDetail.requestInBody
        let data = {}

        if (isRequestInBody) {
          let headers = {
            "Content-Type": "application/json"
          }

          const customHeaders = schemaDetail.headers
          if (customHeaders && typeof customHeaders === "string") {
            const parsedCustomHeaders = JSON.parse(customHeaders) as Record<
              string,
              string
            >
            headers = { ...headers, ...parsedCustomHeaders }
          }

          const fullUrl = schemaDetail.url + path
          const bodyContent = parsedArgs.requestBody || parsedArgs

          const response = await fetch(fullUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(bodyContent)
          })

          if (!response.ok) {
            data = { error: response.statusText }
          } else {
            data = await response.json()
          }
        } else {
          const queryParams = new URLSearchParams(
            parsedArgs.parameters
          ).toString()
          const fullUrl =
            schemaDetail.url + path + (queryParams ? "?" + queryParams : "")

          let headers = {}
          const customHeaders = schemaDetail.headers
          if (customHeaders && typeof customHeaders === "string") {
            headers = JSON.parse(customHeaders)
          }

          const response = await fetch(fullUrl, {
            method: "GET",
            headers
          })

          if (!response.ok) {
            data = { error: response.statusText }
          } else {
            data = await response.json()
          }
        }

        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(data)
        })
      }
    }

    // دومین فراخوانی برای استریم پاسخ نهایی
    const secondResponse = await streamText({
      model: openaiClient(chatSettings.model),
      messages,
      maxTokens:
        CHAT_SETTING_LIMITS[chatSettings.model]?.MAX_TOKEN_OUTPUT_LENGTH || 4096
    })

    return secondResponse.toTextStreamResponse()
  } catch (error: any) {
    console.error(error)
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode,
      headers: { "Content-Type": "application/json" }
    })
  }
}
