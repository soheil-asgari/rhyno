import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
interface DetectionResult {
  code: string
  title: string
  type: "DL" | "SL"
  matchedKeyword: string
}

export const INTERNAL_BANK_ACCOUNTS = [
  {
    // بانک ملی شعبه مرکزی مراغه (کد 200001)
    keywords: [
      "0104813180001", // حالت استاندارد
      "104813180001", // حالت بدون صفر اول
      "813180001", // حالت کوتاه (بخش اصلی)
      "18000101048131" // حالت معکوس احتمالی (کد شعبه در آخر)
    ],
    dl: "200001",
    title: "بانک ملی شعبه مرکزی مراغه"
  },
  {
    // بانک اقتصاد نوین شعبه مراغه (حساب جاری اصلی - کد 200002)
    keywords: [
      "1021261161111", // استاندارد
      "2611611111021", // معکوس (مشاهده شده در PDF)
      "261161111", // کوتاه (بدون کد شعبه)
      "1021261" // کد شعبه و شماره کوتاه
    ],
    dl: "200002",
    title: "بانک اقتصاد نوین شعبه مراغه (حساب جاری)"
  },
  {
    // بانک اقتصاد نوین شعبه مراغه (حساب دوم - کد 200003)
    keywords: [
      "102185061161111", // استاندارد
      "161161118501021", // معکوس (مشاهده شده در PDF)
      "16116111850", // کوتاه شده در متن
      "85061161111", // کوتاه
      "6116111850" // بخش اصلی حساب بدون شعبه
    ],
    dl: "200003",
    title: "بانک اقتصاد نوین شعبه مراغه (حساب دوم)"
  },
  {
    // بانک پاسارگاد شعبه مرکزی مراغه (کد 200004)
    keywords: [
      "16048100100425641", // استاندارد
      "100425641", // کوتاه (شماره سپرده)
      "0425641160481001" // معکوس احتمالی
    ],
    dl: "200004",
    title: "بانک پاسارگاد شعبه مرکزی مراغه"
  },
  {
    // بانک تجارت مراغه (کد 200005)
    keywords: [
      "546093999" // استاندارد
    ],
    dl: "200005",
    title: "بانک تجارت مراغه"
  },
  {
    // بانک سپه شعبه مراغه (حساب اول - کد 200006)
    keywords: [
      "1669252000", // با پسوند سیستمی
      "1669252", // کوتاه و رایج
      "92521669" // معکوس احتمالی
    ],
    dl: "200006",
    title: "بانک سپه شعبه مراغه"
  },
  {
    // بانک سپه شعبه مراغه (حساب دوم - کد 200007)
    keywords: ["540947000", "540947", "0947540"],
    dl: "200007",
    title: "بانک سپه شعبه مراغه"
  },
  {
    // بانک آینده شعبه مراغه (حساب اول - کد 200010)
    keywords: [
      "0100127174001", // استاندارد
      "100127174001", // بدون صفر
      "127174001", // کوتاه
      "7400101001271" // معکوس احتمالی
    ],
    dl: "200010",
    title: "بانک آینده شعبه مراغه"
  },
  {
    // بانک آینده شعبه مراغه (حساب دوم - کد 200019)
    keywords: [
      "0201734828005", // استاندارد
      "201734828005", // بدون صفر
      "734828005", // کوتاه
      "8280050201734" // معکوس احتمالی
    ],
    dl: "200019",
    title: "بانک آینده شعبه مراغه"
  },
  {
    // بانک ملی مراغه (کد 200026)
    keywords: [
      "0223789681001", // استاندارد
      "223789681001", // بدون صفر
      "0171056896", // شماره شبا/کارت قدیمی مرتبط
      "171056896" // کارت بدون صفر
    ],
    dl: "200026",
    title: "بانک ملی مراغه"
  },
  {
    // بانک مسکن مرکزی مراغه (کد 200033)
    keywords: [
      "14005303749",
      "5303749", // کوتاه
      "037491400530" // معکوس احتمالی
    ],
    dl: "200033",
    title: "بانک مسکن مرکزی مراغه"
  },
  {
    // بانک ملت شعبه بهشتی مراغه (کد 200034)
    keywords: [
      "9880346828" // استاندارد
    ],
    dl: "200034",
    title: "بانک ملت شعبه بهشتی مراغه"
  },
  {
    // بانک کارآفرین شهید بهشتی (کد 200035)
    keywords: [
      "0101684239601", // استاندارد
      "101684239601", // بدون صفر
      "1684239601" // کوتاه
    ],
    dl: "200035",
    title: "بانک کار آفرین شهید بهشتی"
  },
  {
    // بانک ملی مراغه (طرح مهربانی - کد 200036)
    keywords: [
      "0364507742001", // استاندارد
      "364507742001", // بدون صفر
      "64507742001", // کوتاه
      "IR4801700000000364507742001"
    ],
    dl: "200036",
    title: "بانک ملی مراغه (طرح مهربانی)"
  },
  {
    // بانک کارآفرین شهید بهشتی (حساب دیگر - کد 200037)
    keywords: [
      "3201784853609", // استاندارد
      "784853609" // کوتاه
    ],
    dl: "200037",
    title: "بانک کار آفرین شهید بهشتی (شعبه بهشتی)"
  },
  {
    // بانک ملی مراغه (حساب جدید - کد 200038)
    keywords: [
      "0233196898007", // استاندارد
      "233196898007", // بدون صفر
      "33196898007" // کوتاه
    ],
    dl: "200038",
    title: "بانک ملی مراغه - حساب جدید"
  },
  {
    // بانک اقتصاد نوین مراغه (حساب سپرده - کد 200039)
    keywords: [
      "102175061161111", // استاندارد
      "750611611111021", // معکوس احتمالی
      "75061161111" // کوتاه
    ],
    dl: "200039",
    title: "بانک اقتصاد نوین مراغه - حساب سپرده"
  },
  {
    // بانک ملت شعبه سردار جنگل مراغه (کد 200040)
    keywords: [
      "2324874267" // استاندارد
    ],
    dl: "200040",
    title: "بانک ملت شعبه سردار جنگل مراغه"
  },
  {
    // بانک کارآفرین شهید بهشتی (کد 200042)
    keywords: [
      "1102009952609", // استاندارد
      "2009952609" // کوتاه
    ],
    dl: "200042",
    title: "بانک کار آفرین شهید بهشتی"
  }
]

function toEnglishDigits(str: string): string {
  return str
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
}

// تابع کمکی برای پیدا کردن بانک از روی شماره
export function matchBankByNumber(
  numberStr: string
): { dlCode: string; title: string } | null {
  // 1. تمیزکاری ورودی
  const cleanInput = toEnglishDigits(numberStr).replace(/[^0-9]/g, "")

  if (cleanInput.length < 5) return null

  let bestMatch = null
  let maxMatchLength = 0

  for (const bank of INTERNAL_BANK_ACCOUNTS) {
    for (const key of bank.keywords) {
      // 2. تمیزکاری کلید
      const cleanKey = toEnglishDigits(key).replace(/[^0-9]/g, "")

      if (!cleanKey) continue

      // 3. بررسی تطابق دو طرفه
      if (cleanInput.includes(cleanKey) || cleanKey.includes(cleanInput)) {
        // طول بخش مشترک را پیدا می‌کنیم (معمولا طولِ کوچکترِ این دو است)
        // اما اینجا چون بحث 'includes' است، طول cleanKey مهم است اگر ورودی بزرگتر باشد
        const matchLen = Math.min(cleanInput.length, cleanKey.length)

        // شرط اطمینان (حداقل 5 رقم)
        if (matchLen >= 5) {
          // 🔥 تغییر حیاتی: اگر این تطابق "طولانی‌تر" از قبلی است، آن را نگه دار
          // این باعث می‌شود 161161118501021 (طولانی) برنده شود، نه 16116111850 (کوتاه)
          if (matchLen > maxMatchLength) {
            maxMatchLength = matchLen
            bestMatch = { dlCode: bank.dl, title: bank.title }
          }
        }
      }
    }
  }

  // در نهایت بهترین گزینه را برگردان
  return bestMatch
}

// ---------------------------------------------------------
// 2. تابع تشخیص هوشمند بانک (مرجع واحد)
// ---------------------------------------------------------
export function detectBankInfoByNumber(
  identifier: string,
  excludeDLCode?: string | null
): {
  slCode: string
  dlCode: string
  bankName: string
} {
  const DEFAULT = {
    slCode: "111005",
    dlCode: "200001",
    bankName: "بانک نامشخص (پیش‌فرض)"
  }

  if (!identifier) return DEFAULT

  // تمیزکاری ورودی: حذف تمام غیر اعداد
  const cleanInput = identifier.replace(/\D/g, "") // \D یعنی هر چیزی غیر از عدد

  if (cleanInput.length < 5) return DEFAULT

  for (const bank of INTERNAL_BANK_ACCOUNTS) {
    for (const key of bank.keywords) {
      // ✅ نکته مهم: تمیزکاری کلیدهای کانفیگ قبل از مقایسه
      const cleanKey = key.replace(/\D/g, "")

      // مقایسه دو طرفه (شاید ورودی بخشی از کلید باشد یا برعکس)
      if (cleanInput.includes(cleanKey) || cleanKey.includes(cleanInput)) {
        // اطمینان از حداقل ۵ رقم تطابق
        const commonLen = Math.min(cleanInput.length, cleanKey.length)
        if (commonLen >= 5) {
          return {
            slCode: "111005",
            dlCode: bank.dl,
            bankName: bank.title
          }
        }
      }
    }
  }

  return DEFAULT
}

export async function findBestEntitiesByEmbedding(
  supabase: any, // کلاینت سوپابیس را پاس بدهید
  searchText: string,
  matchCount: number = 5
) {
  try {
    // ۱. تولید امبدینگ برای متن جستجو
    // نکته: مدلی که اینجا استفاده می‌کنید باید دقیقاً همان مدلی باشد که دیتابیس با آن پر شده
    const embeddingResponse = await openai.embeddings.create({
      model: "qwen/qwen3-embedding-8b", // یا مدلی که استفاده کردید
      input: searchText.replace(/\n/g, " ")
    })

    const embedding = embeddingResponse.data[0].embedding

    // ۲. فراخوانی RPC در سوپابیس
    const { data: documents, error } = await supabase.rpc(
      "match_rahkaran_entities",
      {
        query_embedding: embedding,
        match_threshold: 0.3, // میزان شباهت (بین ۰ تا ۱)
        match_count: matchCount
      }
    )

    if (error) {
      console.error("❌ Supabase Vector Search Error:", error)
      return []
    }

    return documents.map((doc: any) => ({
      code: doc.code, // فرض بر این است که ستون کد دارید
      title: doc.title, // فرض بر این است که ستون تایتل دارید
      similarity: doc.similarity
    }))
  } catch (e) {
    console.error("Embedding Search Failed:", e)
    return []
  }
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
  "تمتی چک",
  "تمبر",
  "ضمام",
  "ضمان"
]

export async function extractCounterpartyBankWithAI(
  description: string,
  hostDLCode?: string | null
): Promise<{ dlCode: string; title: string } | null> {
  // پیدا کردن اطلاعات بانک میزبان برای اینکه به AI بگوییم این را نادیده بگیر
  let hostInfo = ""
  if (hostDLCode) {
    const hostBank = INTERNAL_BANK_ACCOUNTS.find(b => b.dl === hostDLCode)
    if (hostBank) {
      // به AI میگوییم این شماره‌ها را ایگنور کن چون مال خودمان است
      hostInfo = `CRITICAL: You MUST IGNORE this account number (Host/My Account): ${hostBank.keywords[0]} or any similar format. Do NOT return this number.`
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "openai/gpt-5-mini", // مدل سریع
      messages: [
        {
          role: "system",
          content: `You are a bank transaction text analyzer.
          Task: Extract the *Counterparty* (Other Side) Bank Account Number from the text.
          
          Rules:
          1. ${hostInfo}
          2. Find the account number that is the SOURCE (if deposit) or DESTINATION (if withdrawal).
          3. Only return digits.
          4. If the only account number in text is the Host Account, return null.
          
          Output JSON: { "found_number": "123456789" } or { "found_number": null }`
        },
        {
          role: "user",
          content: `Text: "${description}"`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")
    const foundNumber = result.found_number

    if (foundNumber) {
      console.log(`🤖 AI Extracted Number: ${foundNumber}`)

      // حالا چک می‌کنیم این شماره در لیست بانک‌های ما هست یا نه
      const matchedBank = matchBankByNumber(foundNumber)

      if (matchedBank) {
        // چک نهایی امنیتی: اگر AI اشتباه کرد و دوباره کد میزبان را داد، ما جلویش را می‌گیریم
        if (hostDLCode && matchedBank.dlCode === hostDLCode) {
          console.warn(
            "🤖 AI returned host bank despite instructions. Ignoring."
          )
          return null
        }
        return matchedBank
      }
    }
  } catch (e) {
    console.error("AI Extraction Failed:", e)
  }

  return null
}

// ---------------------------------------------------------
// تابع جدید: استخراج هوشمند بانک از شرح (برای موارد نامشخص)
// ---------------------------------------------------------
export function recoverBankFromDescription(
  description: string,
  excludeDLCode?: string | null // ✅ آرگومان جدید برای جلوگیری از انتخاب خودمان
): { code: string; title: string } | null {
  if (!description) return null

  // 1. نرمال‌سازی اعداد (تبدیل فارسی به انگلیسی)
  const normalizedDesc = description
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())

  // 2. الگوی یابی قدرتمند (Regex)
  // گروه اول: شماره‌های با جداکننده (مثل 1-611...)
  // گروه دوم: شماره‌های طولانی و پیوسته (مثل شبا یا شماره کارت یا سپرده‌های ملی)
  const accountPattern =
    /(\d{1,5}[-.\/]\d{1,10}[-.\/]\d{1,10}(?:[-.\/]\d{1,5})?)|(\d{10,26})/g

  const matches = normalizedDesc.match(accountPattern)

  if (matches) {
    // 🔄 شروع جستجوی سریالی: تک تک شماره‌های پیدا شده را چک کن
    for (const rawMatch of matches) {
      // تمیزکاری (حذف خط تیره و ...)
      const cleanNumber = rawMatch.replace(/[-.\/]/g, "")

      // آیا این شماره در لیست بانک‌های ما هست؟
      const detected = detectBankInfoByNumber(cleanNumber)

      // شرط 1: بانک معتبر پیدا شده باشد (کد 200001 یعنی نامشخص)
      if (detected.dlCode !== "200001") {
        // شرط 2 (حیاتی): بانک پیدا شده، نباید همان بانک میزبان باشد!
        if (excludeDLCode && detected.dlCode === excludeDLCode) {
          console.log(
            `⚠️ RecoverLoop: Found Host Bank (${detected.bankName}) in desc. Skipping to next number...`
          )
          continue // ⏩ برو سراغ شماره بعدی در متن!
        }

        // اگر رسیدیم اینجا، یعنی یک بانک "غریبه" و "معتبر" پیدا کردیم. پیروزی! 🎯
        console.log(
          `✅ Recovered Bank from Description: ${detected.bankName} (Ref: ${cleanNumber})`
        )
        return {
          code: detected.dlCode,
          title: detected.bankName
        }
      }
    }
  }

  return null // اگر همه شماره‌ها را گشتیم و چیزی پیدا نشد
}

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
  if (desc.includes("جبران رسوب")) {
    // اگر فرمت شماره حساب (حداقل دو خط تیره یا فرمت خاص) دیده شد
    // مثل: 1-6116111-850-10
    const hasAccountNumber = /\d+[-\/]\d+[-\/]\d+/.test(desc)

    if (hasAccountNumber) {
      console.log(
        "🛡️ Force Override: Jobran Rosub with Account # is NOT a fee."
      )
      // برگرداندن false باعث می‌شود سیستم در مراحل بعد سراغ تشخیص "انتقال" برود
      return {
        isFee: false,
        reason: "جبران رسوب دارای شماره حساب (تراکنش داخلی)"
      }
    }
  }
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
        model: "openai/gpt-5-mini",
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
      model: "openai/gpt-5-mini",
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

export async function findSmartRule(
  description: string,
  partyName: string
): Promise<DetectionResult | null> {
  // تمیزکاری متن ورودی
  const textToSearch = `${description} ${partyName}`.toLowerCase()

  // 1. دریافت تمام اکانت‌هایی که کیورد دارند (فقط آن‌هایی که نال نیستند)
  const { data: rules, error } = await supabase
    .from("rahkaran_accounts")
    .select("code, title, account_type, match_keywords")
    .not("match_keywords", "is", null)

  if (error || !rules) {
    console.error("Error fetching smart rules:", error)
    return null
  }

  // 2. چرخش روی قوانین و پیدا کردن تطابق
  for (const rule of rules) {
    if (!rule.match_keywords) continue

    for (const keyword of rule.match_keywords) {
      // چک کردن وجود کلمه کلیدی در متن
      if (textToSearch.includes(keyword.toLowerCase())) {
        return {
          code: rule.code, // مثلا 111003
          title: rule.title, // مثلا تنخواه گردان
          type: (rule.account_type as "DL" | "SL") || "DL",
          matchedKeyword: keyword
        }
      }
    }
  }

  return null
}

// ---------------------------------------------------------
// 🔥 4️⃣ ناظر ارشد مالی (The Senior Auditor) - نسخه نهایی و هوشمند
// ---------------------------------------------------------
// در فایل bankIntelligence.ts

export async function auditVoucherWithAI(data: {
  inputName: string
  inputDesc: string
  amount: number
  selectedAccountName: string
  selectedAccountCode: string | null
  selectedSLCode?: string | null
  isFee?: boolean
}) {
  try {
    const prompt = `
    You are a Smart Financial Auditor. Verify if the selected accounting code matches the transaction.

    Transaction Data:
    - Description: "${data.inputDesc}"
    - Extracted Name: "${data.inputName}"
    - Selected Account: "${data.selectedAccountName}" (Code: ${data.selectedAccountCode})
    - Amount: ${data.amount}

    CRITICAL APPROVAL RULES (Highest Priority):

    1. **EXCEPTION CODE 504600:**
       - If Selected Account Code is "504600", TREAT IT AS A VALID BANK. **APPROVE immediately**.

    2. **INTERNAL TRANSFERS (Jobran Rosob / Self-Transfer):**
       - IF Description explicitly says "Jobran Rosob" OR "Transfer to self/own account":
       - THEN Selected Account MUST be a BANK (Starts with "200...") OR Code "504600".
       - If it is a person/company in this specific context -> REJECT.

    3. **SATNA / PAYA / HAVALE (Method of Payment):**
       - These words describe HOW money is sent.
       - It is **VALID** to send Satna/Paya to a Vendor, Person, or Company.
       - **DO NOT REJECT** just because description says "Satna" and account is not a bank. This was a previous error.

    4. **FUZZY NAME MATCHING (Typos are OK):**
       - Ignore prefixes like "Sherkat", "Bazargani", "Aghaye".
       - Allow slight spelling differences (e.g., "Tehran Risman" == "Tehran Arisman").
       - If the core name sounds similar -> **APPROVE**.

    5. **FEES:**
       - If transaction is a Bank Fee (Commission/Aboman) and code is ~621105 -> **APPROVE**.

    Output JSON ONLY: { "approved": boolean, "reason": "Short explanation" }
    `

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.5-flash", // مدل سریع
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0
    })

    const result = JSON.parse(completion.choices[0].message.content || "{}")

    return {
      approved: result.approved,
      reason: result.reason || "تایید توسط ناظر"
    }
  } catch (error) {
    console.error("Audit Error:", error)
    // در صورت قطعی اینترنت یا خطا، سخت‌گیری نکن و رد نکن
    return {
      approved: true,
      reason: "Audit Service Unavailable - Auto Approved"
    }
  }
}
