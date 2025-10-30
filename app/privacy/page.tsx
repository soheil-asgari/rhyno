// 🎯 مسیر فایل: app/privacy/page.tsx

import { Metadata } from "next"

export const metadata: Metadata = {
  title: "حریم خصوصی | Rhyno AI"
}

export default function PrivacyPage() {
  return (
    <div className="font-vazir text-foreground mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-bold text-white">
        سیاست حفظ حریم خصوصی
      </h1>

      <div className="space-y-6 text-base text-gray-300">
        <p>
          به Rhyno AI خوش آمدید. ما برای حریم خصوصی شما ارزش قائل هستیم. این سند
          توضیح می‌دهد که ما چه اطلاعاتی را جمع‌آوری می‌کنیم و چگونه از آن
          استفاده می‌کنیم.
        </p>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            اطلاعاتی که جمع‌آوری می‌کنیم
          </h2>
          <p>
            هنگامی که شما در سرویس ما ثبت‌نام می‌کنید یا از آن استفاده می‌کنید،
            ما ممکن است اطلاعات زیر را جمع‌آوری کنیم:
          </p>
          <ul className="mr-6 list-disc space-y-2 py-2">
            <li>
              <strong>اطلاعات حساب کاربری:</strong> مانند نام، آدرس ایمیل و رمز
              عبور (به صورت رمزنگاری شده).
            </li>
            <li>
              <strong>اطلاعات استفاده:</strong> اطلاعات مربوط به نحوه تعامل شما
              با سرویس ما، مانند پرامپت‌های ورودی و نتایج خروجی.
            </li>
            <li>
              <strong>اطلاعات ورود (Sign-in):</strong> در صورت استفاده از ورود
              با گوگل، ما اطلاعات پایه‌ای پروفایل شما (مانند ایمیل و نام) را که
              توسط گوگل ارائه می‌شود، دریافت می‌کنیم.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            چگونه از اطلاعات شما استفاده می‌کنیم
          </h2>
          <p>ما از اطلاعات جمع‌آوری شده برای اهداف زیر استفاده می‌کنیم:</p>
          <ul className="mr-6 list-disc space-y-2 py-2">
            <li>ارائه، نگهداری و بهبود سرویس‌هایمان.</li>
            <li>احراز هویت کاربران و جلوگیری از سوءاستفاده.</li>
            <li>پاسخ به درخواست‌های پشتیبانی شما.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            امنیت اطلاعات
          </h2>
          <p>
            ما متعهد به حفاظت از اطلاعات شما هستیم و از اقدامات امنیتی استاندارد
            صنعتی برای جلوگیری از دسترسی غیرمجاز استفاده می‌کنیم.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            تغییرات در این سیاست
          </h2>
          <p>
            ما ممکن است هر از چند گاهی این سیاست حفظ حریم خصوصی را به‌روزرسانی
            کنیم. توصیه می‌کنیم این صفحه را به صورت دوره‌ای مرور کنید.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">تماس با ما</h2>
          <p>
            اگر در مورد این سیاست حفظ حریم خصوصی سؤالی دارید، لطفاً با ما تماس
            بگیرید.
          </p>
        </section>
      </div>
    </div>
  )
}
