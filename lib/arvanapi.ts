import OpenAI from "openai"

// کلاینت مربوط به مدل GPT-5 Mini
export const gpt5Client = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY,
  baseURL:
    "https://arvancloudai.ir/gateway/models/GPT-5-Mini/00CY8lXKXPAsfYWSXH3FELsumI_9aePBgcOxxQ6rsDS1hlhp_8BjWAGz2vsKEfzpiPXdWvQ9HqXj7hsuur36Wto8tV6WSvSASE__KEAm-O1C90o5GYddPRjvKRHEadEzvymkVTQRf2wltLCpt4uD_RvN3uGc05Ma0FmhnnUY7Kri18vgC5UE-KEFhfWjWp6iWOUqQt2k23hfGpJYgKOZoBFfW9dDAYuzyosT6sOIORC6xCbagPzWoQHo/v1"
})

// کلاینت مربوط به مدل Gemini 2.5 Pro
export const geminiClient = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY,
  baseURL:
    "https://arvancloudai.ir/gateway/models/Gemini-2.5-Pro/1_JS1NTxmEW4GkOR_6rOkB4LeL4VYdgfmDe6IvW1B6aH8m-6On7cHNaT7Vk5jb42YAeFbZPMr0ZglWI8Dhf9JqC9eHZrOpBSlvvIWfvYtDFagF4I2rnhgutxiiFJlLOz8KLOpt5TqmoXnDoKQ0_TF25Qi74gmoOOV3HgCZG8HCZNEX_fXsOAPMUoWra9sRCdL0fkmpi8QPp-xvW5rxCTZeL2qnc9HVNOH640aRTvQHYXEXBXKiSYNeDZpqR-UmPoKCM/v1"
})

export const gemini3Client = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY,
  baseURL:
    "https://arvancloudai.ir/gateway/models/Gemini-3-Pro-Preview/zivX2IZwrIIJWGA2E9w6RUOWVORzA2mqzqSOeTI3saOE95Fxw97ChkrvMvSjCajxsQwTl4W5CJXaIR5q10QsOezOsZty3pu-DtpGAm2USbKWpCGmHCwt_YTwvPawePO7AajmnNuvlY6V6OYd0eRSNjIsJO4aB_FLE0_3MVJuxeWij5_383CQFTrhGOkKjmuglw0rBwhv9NgDkCoJSGk3dF_jv6Cpl4bXnBNh43YGcMUpH9VMGp_uMNknKLUTSnILatjXYJwx-HvPdlMg8Q4/v1"
})

export const embeddingClient = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY, // کلید خود را در .env قرار دهید
  baseURL:
    "https://arvancloudai.ir/gateway/models/Bge-m3/MbtQE83ppr6qivkw8BYi3dfrk08uLo9BJffmH33drPAi8-TKSzO_VBvXgQqp-ha2M8-QlBVYJ8XeHsFDb_S3pZa2CEPMZVP1yGzCrB0EqGYA5JBNKJ8VyfIPiDiTYjH3KfsDbldX1znSzKIHlSRVFr1OwZ_k7zHE6tUHXoolytZRmDIzwcTugLTPZ4-VE_8QLeun0xRyUKtHrKrKd3rgba_JcLnhFMUpgJH7iMupQS-f7A/v1"
})

export const gpt5 = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY, // کلید خود را در .env قرار دهید
  baseURL:
    "https://arvancloudai.ir/gateway/models/GPT-5/VD1yD7dE6Xvpr-tHXouRk5wY1hAn_ftuLNtVilk50rBQ2c2kgve4f88jyc8oaNE44wMTcS-IuWnSL4-pCjN3GiRr_zQH-Cs8N0hlTBARdsJhhFLKx7akvYeIFGfN_9INbKu-v_ykfc1_h4Uyh7CrD9LEHKZ5qOoBDwG-k4Nh452fPWoVxg8pY7vJIJzGPF2IpeDJM08za2CcAIxwIhG_uE2tMosGqaWT7w7rqBIREkI/v1"
})

// تعریف ثابت نام مدل‌ها برای جلوگیری از غلط املایی در فایل‌های دیگر
export const AI_MODELS = {
  GPT5_MINI: "GPT-5-Mini-w92wh",
  GEMINI_PRO: "Gemini-2-5-Pro-toh3v",
  Embeddings: "Bge-m3-ykjpn",
  GPT5: "GPT-5-tyy1b",
  GEMINI_3: "Gemini-3-Pro-Preview-6uf0r"
} as const
