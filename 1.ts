export async function analyzeSinglePage(
  fileUrl: string,
  pageNumber: number,
  text: string = ""
): Promise<SinglePageResult> {
  console.log(`🚀 Processing PDF: ${fileUrl}`)

  // 🛡️ گارد امنیتی: بررسی وجود کلید قبل از درخواست
  if (!OPENROUTER_API_KEY) {
    console.error("❌ ERROR: OPENROUTER_API_KEY is missing in .env file")
    return {
      success: false,
      error: "کلید API تنظیم نشده است. لطفاً فایل .env را بررسی کنید."
    }
  }

  try {
    // 1. دانلود فایل PDF
    const fileRes = await fetch(fileUrl, { cache: 'no-store' })
    if (!fileRes.ok) throw new Error("دانلود فایل از سرور ناموفق بود")

    const fileBuffer = await fileRes.arrayBuffer()
    const base64Data = Buffer.from(fileBuffer).toString("base64")

    const isPdf = fileUrl.toLowerCase().includes(".pdf")
    const mimeType = isPdf ? "application/pdf" : "image/jpeg"
    const dataUrl = `data:${mimeType};base64,${base64Data}`

    console.log(`📡 Sending request to OpenRouter with model: ${AI_MODEL}`)

    // 2. ارسال به OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`, // اینجا نباید undefined باشد
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
                You are a financial OCR engine. Extract data from this ${isPdf ? "PDF document" : "image"} into JSON.
                
                Expected JSON Structure:
                {
                  "bank_name": "Persian Name",
                  "account_number": "Digits only",
                  "dl_code": "Optional code",
                  "transactions": [
                    {
                       "date": "YYYY/MM/DD",
                       "time": "HH:MM",
                       "amount": 1000,
                       "type": "deposit" | "withdrawal",
                       "description": "Full text",
                       "tracking_code": "Ref ID",
                       "partyName": "Person/Company Name"
                    }
                  ]
                }
                
                Rules:
                - Return VALID JSON only.
                - Remove commas from amounts.
                `
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        temperature: 0,
      }),
      cache: "no-store" // جلوگیری از کش شدن نتیجه
    })

    // 3. بررسی خطا
    if (!response.ok) {
      const errText = await response.text()
      console.error("❌ OpenRouter API Response Error:", errText)
      // اگر ارور 401 داد یعنی کلید غلط است
      if (response.status === 401) {
        return { success: false, error: "کلید API اشتباه است یا اعتبار ندارد (401)" }
      }
      throw new Error(`OpenRouter Error: ${response.status} - ${errText}`)
    }

    const json = await response.json()
    let rawContent = json.choices[0]?.message?.content || "{}"
    rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim()

    const data = JSON.parse(rawContent)
    console.log(`✅ Success! Extracted ${data.transactions?.length || 0} txs.`)

    return { success: true, data }

  } catch (error: any) {
    console.error("❌ Analyze Exception:", error)
    return { success: false, error: error.message || "خطا در پردازش فایل" }
  }
}