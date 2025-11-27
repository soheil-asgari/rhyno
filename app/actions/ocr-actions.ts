"use server"

import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function extractReceiptData(imageUrl: string) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "شما یک دستیار مالی دقیق هستید. وظیفه شما استخراج اطلاعات از تصویر فیش بانکی ایران است. خروجی باید فقط JSON باشد."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "لطفاً نام دریافت کننده (تامین کننده)، مبلغ (به عدد)، تاریخ پرداخت و شماره پیگیری را استخراج کن. فرمت خروجی: { supplier_name, amount, payment_date, tracking_code }"
            },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      response_format: { type: "json_object" }
    })

    const data = JSON.parse(response.choices[0].message.content || "{}")
    return { success: true, data }
  } catch (error) {
    console.error("OCR Error:", error)
    return { success: false, error: "خطا در خواندن تصویر" }
  }
}
