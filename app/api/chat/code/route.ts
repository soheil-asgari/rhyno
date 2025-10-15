// Imports at the top of the file
import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { modelsWithRial } from "@/app/checkout/pricing"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { ServerRuntime } from "next"
import fs from "fs/promises"
import path from "path"
import * as XLSX from "xlsx"
import os from "os"

export const runtime: ServerRuntime = "nodejs"

// ... (calculateUserCostUSD function remains unchanged)
const PROFIT_MARGIN = 1.4

function calculateUserCostUSD(
  modelId: string,
  usage: { prompt_tokens: number; completion_tokens: number }
): number {
  const model = modelsWithRial.find(m => m.id === modelId)
  if (!model) return 0

  const promptCost =
    (usage.prompt_tokens / 1_000_000) * model.inputPricePer1MTokenUSD
  const completionCost =
    (usage.completion_tokens / 1_000_000) * model.outputPricePer1MTokenUSD

  return (promptCost + completionCost) * PROFIT_MARGIN
}

export async function POST(request: Request) {
  // console.log("✅ درخواست به API کدنویسی (معماری نهایی) رسید!")

  try {
    const { messages } = await request.json()

    // ... (Authentication and OpenAI Client setup remains unchanged)
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const userId = user.id

    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single()

    if (!wallet || wallet.balance <= 0) {
      return NextResponse.json(
        { message: "موجودی شما برای اجرای کد کافی نیست." },
        { status: 402 }
      )
    }

    const profile = await getServerProfile()
    checkApiKey(profile.openai_api_key, "OpenAI")
    const openai = new OpenAI({
      apiKey: profile.openai_api_key || "",
      organization: profile.openai_organization_id
    })

    // =================================================================
    // START: Final, Smarter Instructions
    // =================================================================
    const instructions = `
      You are an expert data analysis assistant. Your primary function is to generate structured data from user requests.
      Your main capability is to create data for table-based files (like Excel or CSV).
      If a user asks for a data table in a format you cannot directly produce (like a PDF), you MUST acknowledge their request and state that you will provide the data in an Excel (.xlsx) file, which they can then save as a PDF.
      For any request that involves creating a table of data, your final output MUST BE ONLY a single, valid JSON string.
      If the data has multiple rows, return a JSON array of objects. If it has one row, you can return a single JSON object. Do not output any other text.
    `
    // =================================================================
    // END: Final Instructions
    // =================================================================

    const modelId = "gpt-4o-mini"

    // console.log("🚀 درخواست پردازش داده به JSON از OpenAI...")
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [{ role: "system", content: instructions }, ...messages],
      response_format: { type: "json_object" }
    })

    // console.log("✅ پاسخ JSON از OpenAI دریافت شد.")
    const usage = response.usage
    if (usage) {
      // ... (Cost deduction logic)
    }

    let outputText = "فایل شما با موفقیت ایجاد شد."
    let fileOutput

    const jsonContent = response.choices[0].message.content
    if (jsonContent) {
      try {
        let dataArray
        const parsedJson = JSON.parse(jsonContent)

        if (Array.isArray(parsedJson)) {
          dataArray = parsedJson
        } else if (typeof parsedJson === "object" && parsedJson !== null) {
          const potentialArray = Object.values(parsedJson).find(Array.isArray)
          if (potentialArray && potentialArray.length > 0) {
            dataArray = potentialArray
          } else {
            dataArray = [parsedJson]
          }
        }

        if (
          !dataArray ||
          dataArray.length === 0 ||
          typeof dataArray[0] !== "object"
        ) {
          // If we still don't have a valid array, it means the AI returned a message (like an error).
          // We will display this message directly instead of creating a file.
          return new Response(jsonContent, {
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          })
        }

        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.json_to_sheet(dataArray)
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
        const buffer = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "buffer"
        })

        const originalFilename = `output_${Date.now()}.xlsx`
        const tempFilePath = path.join(os.tmpdir(), originalFilename)

        await fs.writeFile(tempFilePath, buffer)
        // console.log(
        //   `✅ فایل اکسل با موفقیت در ${tempFilePath} ساخته و ذخیره شد.`
        // )

        fileOutput = { filename: originalFilename }
      } catch (e) {
        console.error("❌ خطا در پردازش JSON یا ساخت فایل اکسل:", e)

        let errorMessage = "An unknown error occurred during JSON processing."
        if (e instanceof Error) {
          errorMessage = e.message
        }

        return new Response(
          `خطا در پردازش پاسخ مدل: ${errorMessage}\n\nپاسخ دریافتی:\n${jsonContent}`,
          { status: 500 }
        )
      }
    }

    if (fileOutput) {
      const origin = new URL(request.url).origin
      const downloadUrl = `${origin}/api/chat/download?filename=${encodeURIComponent(fileOutput.filename)}`
      outputText += `\n\n[📥 دانلود فایل اکسل](${downloadUrl})`
    } else {
      outputText =
        "متاسفانه مشکلی در تولید فایل به وجود آمد. ممکن است مدل پاسخی در فرمت نامناسب ارسال کرده باشد."
    }

    return new Response(outputText, {
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    })
  } catch (error: any) {
    console.error("❌ خطا در API کدنویسی:", error)
    const errorMessage = error.message || "یک خطای غیرمنتظره در سرور رخ داد"
    const status = error.status || 500
    return NextResponse.json({ message: errorMessage }, { status })
  }
}
