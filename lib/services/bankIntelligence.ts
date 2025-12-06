import OpenAI from "openai"

// تنظیمات کلاینت OpenAI
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { "X-Title": "Rhyno Automation" }
})
export interface FeeResult {
  isFee: boolean
  reason: string
}

// لیست کلمات عمومی و کارمزد
const GENERIC_WORDS = new Set([
  "شرکت",
  "موسسه",
  "سازمان",
  "بازرگانی",
  "تولیدی",
  "صنعتی",
  "گروه",
  "خدمات",
  "فنی",
  "مهندسی",
  "تجاری",
  "عمومی",
  "تعاونی",
  "آقای",
  "خانم",
  "فروشگاه",
  "راه",
  "ساختمانی",
  "توسعه",
  "گسترش",
  "پیمانکاری",
  "مشاوره",
  "بین",
  "المللی",
  "سازه",
  "صنعت",
  "طرح",
  "اجرا",
  "نظارت",
  "تجهیزات",
  "مجتمع",
  "کارخانه",
  "راه و ساختمانی",
  "بانک",
  "شعبه",
  "کد",
  "نامشخص",
  "بنام",
  "به",
  "نام",
  "واریز",
  "چک",
  "بابت",
  "امور",
  "دفتر",
  "شیمیایی",
  "شیمی",
  "صنایع",
  "تولیدی",
  "پخش",
  "نوید",
  "گستر",
  "آریا",
  "برتر",
  "نوین",
  "سازه",
  "صنعت"
])
const FEE_KEYWORDS = [
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان", // با و بدون کلاه
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "خدمات بانکی",
  "کارمزد ساتنا",
  "کارمزد پایا",
  "عودت کارمزد  ساتنا/پایا",
  "عودت کارمزد",
  "کارمزد",
  "هزینه بانکی",
  "آبونمان",
  "ابونمان",
  "حق اشتراک",
  "صدور چک",
  "صدور دسته چک",
  "هزینه پیامک",
  "سرویس پیامک",
  "تمبر",
  "خدمات بانکی"
]

// ---------------------------------------------------------
// 1️⃣ تابع الگوریتمی (رایگان و سریع)
// ---------------------------------------------------------
export function verifyNameMatch(inputName: string, foundName: string): boolean {
  // 1. نرمال‌سازی
  const normalize = (s: string) =>
    s
      .replace(/[يیكک]/g, m => (m === "ك" ? "ک" : "ی"))
      .replace(/ئ/g, "ی")
      .replace(/[^\w\s\u0600-\u06FF]/g, "")
      .toLowerCase()

  const inputNorm = normalize(inputName)
  const foundNorm = normalize(foundName)
  const foundMerged = foundNorm.replace(/\s+/g, "") // نسخه چسبیده

  // 2. استخراج توکن‌های مهم ورودی
  const inputTokens = inputNorm
    .split(/\s+/)
    .filter(w => w.length > 2 && !GENERIC_WORDS.has(w))

  // اگر هیچ کلمه خاصی نماند (مثلاً ورودی فقط "شرکت بازرگانی" بود)،
  // ریسک نمی‌کنیم و فال‌بک می‌زنیم (False) تا AI تصمیم بگیرد یا رد شود.
  if (inputTokens.length === 0) return false

  // 3. شمارش تعداد توکن‌های پیدا شده
  let matchCount = 0

  for (const token of inputTokens) {
    // الف: آیا توکن دقیقاً در متن نرمال وجود دارد؟
    const directMatch = foundNorm.includes(token)

    // ب: آیا توکن در متن چسبیده وجود دارد؟ (برای حل مشکل "آذریوردتبریز")
    // شرط طول > 3 برای جلوگیری از مچ شدن کلمات کوتاه داخل کلمات دیگر (مثل "علی" داخل "فعلی")
    const mergedMatch = foundMerged.includes(token) && token.length > 3

    if (directMatch || mergedMatch) {
      matchCount++
    }
  }

  // 4. تصمیم‌گیری نهایی (سخت‌گیرانه)

  // حالت تک کلمه‌ای (مثل "ایرانسل") -> باید پیدا شود
  if (inputTokens.length === 1) {
    return matchCount === 1
  }

  // حالت دو کلمه‌ای (مثل "مهدی صفرخانلو") -> باید هر دو باشند
  // این خط جلوی باگ "مهدی مهدوی" را می‌گیرد
  if (inputTokens.length === 2) {
    return matchCount === 2
  }

  // حالت سه کلمه و بیشتر -> اجازه می‌دهیم ۱ کلمه پیدا نشود (خطای OCR یا کلمه اضافه)
  // مثلا "شرکت مهندسی آذر یورد تبریز شمالی" (۴ کلمه مفید) -> اگر ۳ تا پیدا شد قبول است
  return matchCount >= inputTokens.length - 1
}

// ---------------------------------------------------------
// 2️⃣ تابع تشخیص کارمزد (Rule-Based)
// ---------------------------------------------------------
export function detectFee(
  partyName: string,
  desc: string,
  amount: number
): FeeResult {
  const normalizeText = (text: string) =>
    text ? text.replace(/[يیكک]/g, m => (m === "ك" ? "ک" : "ی")) : ""
  const combinedSearchText = normalizeText(`${partyName} ${desc}`)

  // الف: کلمات کلیدی
  const hasFeeKeyword = FEE_KEYWORDS.some(keyword =>
    combinedSearchText.includes(keyword)
  )

  // ب: مبالغ ریز و نامشخص (سقف ۱ میلیون ریال)
  const isSmallUnspecified =
    (partyName.includes("نامشخص") || partyName.trim() === "") &&
    amount < 1000000 &&
    !combinedSearchText.includes("انتقال")

  if (hasFeeKeyword) {
    return { isFee: true, reason: "Fee Keyword Detected" }
  }

  if (isSmallUnspecified) {
    return { isFee: true, reason: "Small Amount & Unspecified" }
  }

  // اگر کارمزد نبود
  return { isFee: false, reason: "" }
}

// ---------------------------------------------------------
// 3️⃣ قاضی هوش مصنوعی (برای تطابق نام)
// ---------------------------------------------------------

export async function verifyWithAI(
  inputName: string,
  dbName: string
): Promise<boolean> {
  if (inputName.trim() === dbName.trim()) return true

  try {
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini", // یا مدل دلخواه شما
      messages: [
        {
          role: "system",
          content: `You are a Data Resolution Agent acting as a Fuzzy Matcher.
Your goal is to match entity names even with OCR errors or typos.

Rules:
1. Ignore legal prefixes/suffixes (Sherkat, Aghaye, etc.).
2. Focus on the core Proper Names.
3. ALLOW minor OCR errors or typos (e.g., missing 1-2 letters).
   - Example: "Mehrda" == "Mehrdad" -> MATCH (Missing last letter is common in OCR).
   - Example: "Mohammd" == "Mohammad" -> MATCH.
4. ALLOW word reordering (e.g., "Momeni Mehrdad" == "Mehrdad Momeni").
5. REJECT only if the names are fundamentally different (e.g., "Ali" != "Hassan").
  "آذربورد=آذریورد"
Return JSON: {"match": true} OR {"match": false}.`
        },
        {
          role: "user",
          content: `Compare:
Input: "${inputName}"
Database Candidate: "${dbName}"`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")
    console.log(
      `🤖 AI Judge: "${inputName}" vs "${dbName}" => ${result.match ? "✅ MATCH" : "❌ REJECT"}`
    )
    return result.match === true
  } catch (e) {
    console.error("AI Verification Failed:", e)
    return false
  }
}

// ---------------------------------------------------------
// 🔥 4️⃣ ناظر نهایی (The Auditor) - جدید
// ---------------------------------------------------------
export async function auditVoucherWithAI(
  voucherData: any
): Promise<{ approved: boolean; reason: string }> {
  try {
    const completion = await openai.chat.completions.create({
      model: "qwen/qwen3-vl-8b-instruct", // برای ناظر نهایی از قوی‌ترین مدل استفاده کنید
      messages: [
        {
          role: "system",
          content: `You are a Senior Financial Auditor. 
Your job is to Sanity Check a bank transaction before it is saved to the accounting system.

Fail the transaction (approved: false) IF:
1. A large amount (> 5,000,000 IRR) is categorized as "Bank Fee" (هزینه بانکی).
2. The detected account name clearly contradicts the input name (e.g., "Ali" mapped to "Hassan").
3. The description suggests a "Loan" (وام) but it's mapped to "Income" (درآمد).

Pass the transaction (approved: true) IF:
1. Logic seems sound.
2. It's a "Default/Prepayment" (پیش پرداخت) because name was Unknown.
3. Amounts and Categories match typical accounting logic.

Return JSON: { "approved": boolean, "reason": string }`
        },
        {
          role: "user",
          content: `Audit this voucher:
Input Name: "${voucherData.inputName}"
Input Desc: "${voucherData.inputDesc}"
Amount: ${voucherData.amount}
Selected Account: "${voucherData.selectedAccountName}" (Code: ${voucherData.selectedAccountCode})
Is Fee Logic: ${voucherData.isFee}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")
    return {
      approved: result.approved,
      reason: result.reason || "Auditor decision"
    }
  } catch (e) {
    console.error("Auditor Failed:", e)
    // اگر ناظر خطا داد، محافظه‌کارانه عمل کن یا رد کن، یا تایید کن (بسته به سیاست)
    // اینجا تایید میکنیم تا پروسه نخوابد، ولی لاگ میکنیم
    return { approved: true, reason: "Auditor Offline - Auto Pass" }
  }
}
