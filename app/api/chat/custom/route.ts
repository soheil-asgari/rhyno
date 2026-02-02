import { Database } from "@/supabase/types"
import { ChatSettings } from "@/types"
import { createClient } from "@supabase/supabase-js"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"
import OpenAI from "openai"
import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages, customModelId } = json as {
    chatSettings: ChatSettings
    messages: any[]
    customModelId: string
  }

  try {
    // راه‌اندازی کلاینت Supabase
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // گرفتن مدل سفارشی از Supabase
    const { data: customModel, error } = await supabaseAdmin
      .from("models")
      .select("*")
      .eq("id", customModelId)
      .single()

    if (error || !customModel) {
      throw new Error(error?.message || "مدل سفارشی پیدا نشد")
    }

    // راه‌اندازی OpenAI با API Key و base URL مدل سفارشی
    const custom = new OpenAI({
      apiKey: customModel.api_key || "",
      baseURL: customModel.base_url
    })

    // ایجاد درخواست تکمیل چت با فعال‌سازی استریم
    const response = await custom.chat.completions.create({
      model: chatSettings.model as ChatCompletionCreateParamsBase["model"],
      messages: messages as ChatCompletionCreateParamsBase["messages"],
      temperature: chatSettings.temperature,
      stream: true
    })

    // تبدیل Stream<ChatCompletionChunk> به AsyncIterable<Completion>
    // const stream = OpenAIStream(response)

    // تبدیل stream به نوع مناسب
    // تابعی که یک AsyncGenerator را برمی‌گرداند
    const createMappedStream = async function* () {
      for await (const chunk of response) {
        yield { choices: chunk.choices } // تبدیل chunk به ساختار مناسب
      }
    }

    // فراخوانی تابع برای دریافت AsyncGenerator
    const mappedStream = createMappedStream()

    // تبدیل AsyncGenerator به ReadableStream
    const readableStream = new ReadableStream({
      async pull(controller) {
        try {
          const { value, done } = await mappedStream.next()
          if (done) {
            controller.close()
          } else {
            controller.enqueue(value)
          }
        } catch (err) {
          controller.error(err)
        }
      }
    })

    // بازگشت پاسخ استریم
    return new StreamingTextResponse(readableStream)
  } catch (error: any) {
    // مدیریت خطا: شخصی‌سازی پیام خطاها برای مسائل رایج کلید API
    let errorMessage = error.message || "یک خطای غیرمنتظره رخ داده است"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "کلید API سفارشی پیدا نشد. لطفاً آن را در تنظیمات پروفایل خود وارد کنید."
    } else if (errorMessage.toLowerCase().includes("incorrect api key")) {
      errorMessage =
        "کلید API سفارشی اشتباه است. لطفاً آن را در تنظیمات پروفایل خود اصلاح کنید."
    }

    // بازگشت پیام خطای سفارشی به کاربر
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
