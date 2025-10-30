// 🎯 مسیر فایل: app/terms/page.tsx

import { Metadata } from "next"

export const metadata: Metadata = {
  title: "قوانین و مقررات | Rhyno AI"
}

export default function TermsPage() {
  return (
    <div className="font-vazir text-foreground mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-bold text-white">
        شرایط و قوانین استفاده از خدمات
      </h1>

      <div className="space-y-6 text-base text-gray-300">
        <p>
          با تشکر از استفاده شما از Rhyno AI. استفاده شما از خدمات ما منوط به
          پذیرش و رعایت شرایط و ضوابط زیر است.
        </p>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            1. پذیرش شرایط
          </h2>
          <p>
            با ایجاد حساب کاربری یا استفاده از خدمات Rhyno AI، شما تأیید می‌کنید
            که این شرایط را مطالعه کرده، درک نموده و با آن موافقت کرده‌اید.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            2. حساب کاربری
          </h2>
          <p>
            شما مسئول حفظ محرمانگی اطلاعات حساب کاربری خود، از جمله رمز عبور،
            هستید. تمام فعالیت‌هایی که تحت حساب کاربری شما انجام می‌شود، بر عهده
            شما خواهد بود.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            3. استفاده مجاز
          </h2>
          <p>
            شما موافقت می‌کنید که از خدمات ما برای هیچ هدف غیرقانونی یا ممنوع
            شده توسط این شرایط استفاده نکنید. شما مجاز به استفاده از سرویس برای
            ایجاد محتوای مضر، توهین‌آمیز یا نقض‌کننده حق کپی‌رایت نیستید.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            4. خاتمه دادن به خدمات
          </h2>
          <p>
            ما این حق را برای خود محفوظ می‌داریم که در صورت نقض هر یک از این
            شرایط، دسترسی شما به خدمات را به صلاحدید خود، در هر زمان و بدون
            اطلاع قبلی، به حالت تعلیق درآورده یا خاتمه دهیم.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            5. تغییرات در شرایط
          </h2>
          <p>
            ما ممکن است این شرایط را در طول زمان تغییر دهیم. ادامه استفاده شما
            از سرویس پس از اعمال تغییرات، به منزله پذیرش آن تغییرات خواهد بود.
            &quot;
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-white">
            6. سلب مسئولیت
          </h2>
          <p>
            خدمات &quot;همانطور که هست&quot; ارائه می‌شود. ما هیچ تضمینی در مورد
            دقت، قابلیت اطمینان یا کامل بودن محتوای تولید شده توسط هوش مصنوعی
            نداریم.
          </p>
        </section>
      </div>
    </div>
  )
}
