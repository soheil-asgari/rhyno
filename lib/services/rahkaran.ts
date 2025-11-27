// این تابع شبیه‌ساز اتصال است. در عمل باید به API واقعی راهکاران درخواست بزنید
export async function syncToRahkaranSystem(data: any) {
  console.log("Sending to Rahkaran...", data)

  // شبیه‌سازی تاخیر شبکه
  await new Promise(resolve => setTimeout(resolve, 1000))

  // فرضا راهکاران یک شناسه سند برمی‌گرداند
  return {
    success: true,
    docId: `RAH-${Math.floor(Math.random() * 10000)}` // شناسه سند فرضی
  }
}
