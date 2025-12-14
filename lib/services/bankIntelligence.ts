import OpenAI from "openai"

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://rhyno.ir",
    "X-Title": "Rhyno Automation"
  }
})

export interface FeeResult {
  isFee: boolean
  reason: string
}

export const INTERNAL_BANK_ACCOUNTS = [
  // --- بانک ملی (تفکیک دقیق) ---
  {
    // حساب مهربانی
    keywords: ["0364507742001", "364507742", "364507"],
    dl: "200036",
    title: "بانک ملی (مهربانی)"
  },
  {
    // حساب مرکزی
    keywords: ["0104813180001", "104813180", "104813"],
    dl: "200001",
    title: "بانک ملی (مرکزی)"
  },
  {
    // حساب مراغه
    keywords: ["0223789681001", "223789681", "223789"],
    dl: "200026",
    title: "بانک ملی (مراغه)"
  },
  {
    // حساب جدید
    keywords: ["0233196989007", "233196989"],
    dl: "200038",
    title: "بانک ملی (جدید)"
  },

  // --- بانک اقتصاد نوین ---
  {
    keywords: ["26116111", "1021.261"],
    dl: "200002",
    title: "بانک اقتصاد نوین (جاری)"
  },
  {
    keywords: ["6119111", "850.611"],
    dl: "200003",
    title: "بانک اقتصاد نوین (کوتاه مدت)"
  },
  {
    keywords: ["61161111", "750.611"],
    dl: "200039",
    title: "بانک اقتصاد نوین (سپرده)"
  },

  // --- سایر بانک‌ها ---
  { keywords: ["9880346828"], dl: "200034", title: "بانک ملت (جام)" },
  { keywords: ["2324874267"], dl: "200040", title: "بانک ملت (سردار جنگل)" },
  {
    keywords: ["16048100100425641", "10042564"],
    dl: "200004",
    title: "بانک پاسارگاد"
  },
  { keywords: ["546093999"], dl: "200005", title: "بانک تجارت" },
  { keywords: ["540947"], dl: "200007", title: "بانک سپه" },
  {
    keywords: ["0100127174001", "127174001"],
    dl: "200019",
    title: "بانک آینده"
  },
  { keywords: ["14005303749"], dl: "200033", title: "بانک مسکن" },
  {
    keywords: ["0101684239601", "1684239601"],
    dl: "200035",
    title: "بانک کارآفرین"
  },
  {
    keywords: ["1102009952609", "2009952609"],
    dl: "200042",
    title: "بانک کشاورزی"
  }
]

// ---------------------------------------------------------
// 2. تابع تشخیص هوشمند بانک (مرجع واحد)
// ---------------------------------------------------------
export function detectBankInfoByNumber(identifier: string): {
  slCode: string
  dlCode: string
  bankName: string
} {
  const DEFAULT = {
    slCode: "111005",
    dlCode: "200001", // پیش‌فرض (ملی مرکزی)
    bankName: "بانک ملی (پیش‌فرض)"
  }

  if (!identifier) return DEFAULT

  // 1. تبدیل اعداد فارسی به انگلیسی و حذف هر چیزی غیر از عدد
  const cleanInput = identifier
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[^0-9]/g, "")

  console.log(`🔍 Checking Bank for: [${identifier}] -> Clean: [${cleanInput}]`)

  // اگر ورودی تمیز شده خیلی کوتاه است، برگرد
  if (cleanInput.length < 4) return DEFAULT

  // 2. جستجوی دقیق (Exact or Contains)
  for (const bank of INTERNAL_BANK_ACCOUNTS) {
    // از keywords استفاده می‌کنیم که در بالا تعریف شده
    for (const key of bank.keywords) {
      const cleanKey = key.replace(/[^0-9]/g, "")
      if (cleanInput.includes(cleanKey) || cleanKey.includes(cleanInput)) {
        const commonLen = Math.min(cleanInput.length, cleanKey.length)
        if (commonLen >= 5) {
          // حداقل 5 رقم تطابق
          console.log(`✅ Bank Identified: ${bank.title} (${bank.dl})`)
          return {
            slCode: "111005",
            dlCode: bank.dl,
            bankName: bank.title
          }
        }
      }
    }
  }

  // 3. فال‌بک بر اساس پیش‌شماره (اگر هیچکدام پیدا نشد)
  if (cleanInput.startsWith("0364"))
    return {
      slCode: "111005",
      dlCode: "200036",
      bankName: "بانک ملی (مهربانی - تشخیص پیش‌شماره)"
    }
  if (cleanInput.startsWith("0104"))
    return {
      slCode: "111005",
      dlCode: "200001",
      bankName: "بانک ملی (مرکزی - تشخیص پیش‌شماره)"
    }

  return DEFAULT
}

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
  "پخش",
  "نوید",
  "گستر",
  "آریا",
  "برتر"
])

const FAST_FEE_KEYWORDS = [
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
  "خدمات بانکی",
  "ابطال چک",
  "عودت چک",
  "رفع سوء اثر",
  "کارمزد رفع سوء اثر",
  "صدور چک",
  "تمتی چک"
]

export function verifyNameMatch(inputName: string, foundName: string): boolean {
  const normalize = (s: string) =>
    s
      .replace(/[يیكک]/g, m => (m === "ك" ? "ک" : "ی"))
      .replace(/ئ/g, "ی")
      .replace(/[^\w\s\u0600-\u06FF]/g, "")
      .toLowerCase()

  const inputNorm = normalize(inputName)
  const foundNorm = normalize(foundName)

  if (inputNorm === foundNorm) return true
  if (foundNorm.includes(inputNorm) && inputNorm.length > 4) return true

  const inputTokens = inputNorm
    .split(/\s+/)
    .filter(w => w.length > 2 && !GENERIC_WORDS.has(w))
  if (inputTokens.length === 0) return false

  let matchCount = 0
  for (const token of inputTokens) {
    if (foundNorm.includes(token)) matchCount++
  }

  return matchCount >= Math.ceil(inputTokens.length * 0.7)
}

export async function detectFeeWithAI(
  partyName: string,
  desc: string,
  amount: number
): Promise<FeeResult> {
  const normalizeText = (text: string) =>
    text ? text.replace(/[يیكک]/g, m => (m === "ك" ? "ک" : "ی")) : ""
  const combinedSearchText = normalizeText(`${partyName} ${desc}`)

  const hasFeeKeyword = FAST_FEE_KEYWORDS.some(k =>
    combinedSearchText.includes(k)
  )

  if (amount < 10000 && (partyName === "نامشخص" || partyName === "")) {
    return { isFee: true, reason: "مبلغ ناچیز و طرف حساب نامشخص (Fast Check)" }
  }

  if (hasFeeKeyword) {
    return { isFee: true, reason: "تشخیص کلمه کلیدی کارمزد (Fast Check)" }
  }

  if (amount < 500000) {
    try {
      const aiRes = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              'You are a bank transaction classifier. Answer JSON: { "isFee": boolean }'
          },
          {
            role: "user",
            content: `Is this a bank fee/service charge? Description: "${desc}", Amount: ${amount}`
          }
        ],
        response_format: { type: "json_object" }
      })
      const result = JSON.parse(aiRes.choices[0].message.content || "{}")
      if (result.isFee) {
        return { isFee: true, reason: "تشخیص هوشمند بافت تراکنش (AI Check)" }
      }
    } catch (e) {
      console.error("AI Fee Check Error", e)
    }
  }

  return { isFee: false, reason: "" }
}

export function detectFee(
  partyName: string,
  desc: string,
  amount: number
): FeeResult {
  const res = FAST_FEE_KEYWORDS.some(k => desc.includes(k))
  if (res) return { isFee: true, reason: "Keyword" }
  if (amount < 10000 && partyName === "نامشخص")
    return { isFee: true, reason: "Small Amount" }
  return { isFee: false, reason: "" }
}

export async function verifyWithAI(
  inputName: string,
  dbName: string
): Promise<boolean> {
  // نرمال‌سازی اولیه برای حذف فاصله‌های اضافی
  if (inputName.replace(/\s/g, "") === dbName.replace(/\s/g, "")) return true

  try {
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a fuzzy string matcher for Persian business names.
          
RULES for MATCHING (Return "match": true):
1. **Phonetic Match:** "Arisman" == "Erisman", "Azar" == "Azer".
2. **Repeated Words:** Ignore repeated city names (e.g., "Tehran Erisman Tehran" == "Tehran Arisman").
3. **Prefix/Suffix:** Ignore "Sherkat", "Bazargani", "Gorooh", "Havale", "Satna".
4. **Typos:** Allow minor typos in Persian letters (س/ص, ت/ط, ا/آ).

Input 1: "${inputName}"
Input 2: "${dbName}"

Reply JSON: { "match": boolean }`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")
    return result.match === true
  } catch (e) {
    return false
  }
}

// ---------------------------------------------------------
// 🔥 4️⃣ ناظر ارشد مالی (The Senior Auditor) - نسخه نهایی و هوشمند
// ---------------------------------------------------------
export async function auditVoucherWithAI(voucherData: {
  inputName: string
  inputDesc: string
  amount: number
  selectedAccountName: string
  selectedAccountCode: string | null
  selectedSLCode: string
  isFee: boolean
}): Promise<{ approved: boolean; reason: string; fixedHierarchy?: any }> {
  // 1. تایید اتوماتیک کارمزد
  if (voucherData.isFee)
    return { approved: true, reason: "تایید اتوماتیک: هزینه بانکی" }
  // 2. رد کردن مبلغ صفر
  if (!voucherData.amount || voucherData.amount === 0)
    return { approved: false, reason: "مبلغ صفر" }
  // 3. بررسی وجود حساب
  if (!voucherData.selectedAccountCode)
    return { approved: false, reason: "حساب نامشخص" }

  try {
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a Senior Financial Auditor. Validate the accounting mapping.
          
CRITICAL APPROVAL RULES (Strict Priority Order 1 -> 4):

1. **PERSON / PETTY CASH (Highest Priority):**
   - IF Selected Account is a **Person** (e.g. "Amin...") OR **Petty Cash** ("Tan-khah"):
   - **APPROVE**. Ignore any "Transfer" or account numbers in text.

2. **NAME MATCH (Strong Overrule):**
   - IF Input Name matches Selected Account Name (fuzzy match allowed, e.g. "Tehran Arisman" ~= "Sherkat Arisman"):
   - **APPROVE**.
   - **CRITICAL:** If the name matches, IGNORE the word "Transfer" (انتقالی). A transfer to a specific company/project is valid.

3. **INTERNAL BANK TRANSFER (Smart Check):**
   - IF Description contains "Jobran Rosob", "Internal Transfer", "Transfer" (انتقالی), or "Havale":
     - **CASE A:** Selected Account is a **BANK** (Code starts with "200...") -> **APPROVE**.
     - **CASE B:** Selected Account is a **PROJECT/COMPANY** AND the Input Name/Description contains words from the Selected Account Name -> **APPROVE** (It is a specific transfer to that Project/Company).
     - **CASE C:** Selected Account is NOT a Bank AND Name is NOT in Description -> **REJECT** (Reason: "Generic internal transfer requires a Bank account").

4. **MISMATCH:**
   - IF none of the above apply AND names are totally different:
   - **REJECT**.

Output JSON: { "approved": boolean, "reason": "Short explanation" }`
        },
        {
          role: "user",
          content: `Audit Data:
- Input Name: "${voucherData.inputName}"
- Description: "${voucherData.inputDesc}"
- Selected Account: "${voucherData.selectedAccountName}" (Code: ${voucherData.selectedAccountCode})`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")

    // لاجیک سلسله‌مراتب بانک (اگر واقعاً بانک بود)
    let fixedHierarchy = null
    if (
      result.approved &&
      (voucherData.selectedAccountName.includes("بانک") ||
        voucherData.selectedAccountCode?.startsWith("200"))
    ) {
      fixedHierarchy = {
        group: "داراییهای جاری",
        total: "موجودی نقد وبانک",
        sl: "موجودی بانکهای ریالی"
      }
    }

    return {
      approved: result.approved,
      reason: result.reason || "تایید توسط ناظر",
      fixedHierarchy
    }
  } catch (e) {
    return { approved: true, reason: "تایید سیستمی (عدم دسترسی به ناظر)" }
  }
}
