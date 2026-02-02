// app/api/contact/route.ts
import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, email, message } = body

    // بررسی پر بودن فیلدها
    if (!name || !email || !message) {
      return NextResponse.json(
        { message: "لطفا تمام فیلدها را پر کنید." },
        { status: 400 }
      )
    }

    // تنظیمات Transporter (اطلاعات SMTP خود را اینجا وارد کنید)
    const transporter = nodemailer.createTransport({
      service: "gmail", // سرویس جیمیل را به صورت خودکار می‌شناسد
      auth: {
        user: process.env.EMAIL_USER, // ایمیل شما
        pass: process.env.EMAIL_PASS // رمز عبور App Password
      }
    })

    // تنظیمات محتوای ایمیل
    const mailOptions = {
      from: `"فرم تماس سایت" <info@rhynoai.ir>`, // فرستنده
      to: "info@rhynoai.ir", // گیرنده (ایمیل شما)
      replyTo: email, // وقتی ریپلای می‌زنید، به ایمیل کاربر پاسخ داده شود
      subject: `پیام جدید از: ${name}`, // موضوع ایمیل
      html: `
        <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
          <h2 style="color: #2563eb;">📩 پیام جدید از فرم تماس</h2>
          <p><strong>نام فرستنده:</strong> ${name}</p>
          <p><strong>ایمیل:</strong> ${email}</p>
          <hr style="border-top: 1px dashed #eee;" />
          <p><strong>متن پیام:</strong></p>
          <p style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${message}</p>
        </div>
      `
    }

    // ارسال ایمیل
    await transporter.sendMail(mailOptions)

    return NextResponse.json(
      { message: "ایمیل با موفقیت ارسال شد." },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error sending email:", error)
    return NextResponse.json(
      { message: "خطا در ارسال ایمیل. لطفا بعدا تلاش کنید." },
      { status: 500 }
    )
  }
}
