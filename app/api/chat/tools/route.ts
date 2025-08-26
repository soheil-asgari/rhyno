import { openapiToFunctions } from "@/lib/openapi-conversion"
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { Tables } from "@/supabase/types"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages, selectedTools } = json as {
    chatSettings: ChatSettings
    messages: any[]
    selectedTools: Tables<"tools">[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.openai_api_key, "OpenAI")

    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    let allTools: OpenAI.Chat.Completions.ChatCompletionTool[] = []
    let allRouteMaps = {}
    let schemaDetails = []

    for (const selectedTool of selectedTools) {
      try {
        const convertedSchema = await openapiToFunctions(
          JSON.parse(selectedTool.schema as string)
        )
        const tools = convertedSchema.functions || []
        allTools = allTools.concat(tools)

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
      } catch (error: any) {
        console.error("Error converting schema", error)
      }
    }
    // بررسی و تنظیم مقدار temperature برای مدل‌هایی که از 0.5 پشتیبانی نمی‌کنند
    const temp =
      typeof chatSettings.temperature === "number"
        ? chatSettings.temperature // اگر دما از قبل مشخص شده باشد، همان مقدار استفاده می‌شود
        : [
              "gpt-4-vision-preview", // فقط دمای 1
              "gpt-4o", // فقط دمای 1
              "gpt-4o-mini", // فقط دمای 1
              "gpt-5", // فقط دمای 1
              "gpt-5-mini" // فقط دمای 1
            ].includes(chatSettings.model)
          ? 1 // فقط دمای 1 برای این مدل‌ها
          : 0.7 // مدل‌های دیگر که دمای 0.7 را قبول می‌کنند
    console.log("Final Temperature Before API Request:", temp)
    console.log("Sending first request to OpenAI with messages:", messages)
    console.log("Using tools:", allTools)
    const firstResponse = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages,
      temperature: temp,
      tools: allTools.length > 0 ? allTools : undefined
    })

    const message = firstResponse.choices[0].message
    messages.push(message)
    const toolCalls = message.tool_calls || []

    if (toolCalls.length === 0) {
      return new Response(message.content, {
        headers: {
          "Content-Type": "application/json"
        }
      })
    }

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const functionCall = (toolCall as any).function // Type assertion
        const functionName = functionCall.name
        const argumentsString = functionCall.arguments.trim()
        const parsedArgs = JSON.parse(argumentsString)

        // Find the schema detail that contains the function name
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

        // Determine if the request should be in the body or as a query
        const isRequestInBody = schemaDetail.requestInBody
        let data = {}

        if (isRequestInBody) {
          // If the type is set to body
          let headers = {
            "Content-Type": "application/json"
          }

          // Check if custom headers are set
          const customHeaders = schemaDetail.headers // Moved this line up to the loop
          // Check if custom headers are set and are of type string
          if (customHeaders && typeof customHeaders === "string") {
            let parsedCustomHeaders = JSON.parse(customHeaders) as Record<
              string,
              string
            >

            headers = {
              ...headers,
              ...parsedCustomHeaders
            }
          }

          const fullUrl = schemaDetail.url + path

          const bodyContent = parsedArgs.requestBody || parsedArgs

          const requestInit = {
            method: "POST",
            headers,
            body: JSON.stringify(bodyContent) // Use the extracted requestBody or the entire parsedArgs
          }

          const response = await fetch(fullUrl, requestInit)

          if (!response.ok) {
            data = {
              error: response.statusText
            }
          } else {
            data = await response.json()
          }
        } else {
          // If the type is set to query
          const queryParams = new URLSearchParams(
            parsedArgs.parameters
          ).toString()
          const fullUrl =
            schemaDetail.url + path + (queryParams ? "?" + queryParams : "")

          let headers = {}

          // Check if custom headers are set
          const customHeaders = schemaDetail.headers
          if (customHeaders && typeof customHeaders === "string") {
            headers = JSON.parse(customHeaders)
          }

          const response = await fetch(fullUrl, {
            method: "GET",
            headers: headers
          })

          if (!response.ok) {
            data = {
              error: response.statusText
            }
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
    console.log("Final Temperature Before API Request:", temp)
    // فرض می‌کنیم که `OpenAIStream` برای مدیریت جریان داده‌ها به درستی تعریف شده است، باید نحوه‌ی پردازش `secondResponse` را تغییر دهیم:
    const secondResponse = await openai.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages,
      temperature: temp,
      stream: true
    })

    // نوع بازگشتی را اینجا تغییر می‌دهیم تا با نوع مورد انتظار همخوانی داشته باشد.
    const stream = OpenAIStream(secondResponse as any) // موقتا با استفاده از `any` برای رفع مشکل ناسازگاری نوع

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    console.error(error)
    const errorMessage = error.error?.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
