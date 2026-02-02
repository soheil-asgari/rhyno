import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function test() {
  try {
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "سلام! این یک تست اتصال به API است." }
      ],
    });
    console.log("✅ اتصال موفق! پاسخ API:");
    console.log(response.choices[0].message.content);
  } catch (error) {
    console.error("❌ خطا در اتصال به API:", error);
  }
}

test();
