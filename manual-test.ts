// manual-test.ts
require('dotenv').config({ path: '.env.local' });
const { syncToRahkaranSystem } = require('./lib/services/rahkaran');

async function runTests() {
    console.log("🚀 Starting Comprehensive Tests...");

    // --- سناریو ۱: ثبت سند واریز ---
    console.log("\n--- 1. Testing DEPOSIT (واریز) ---");
    const depositVoucher = {
        mode: "Deposit",
        description: "سند واریز وجه نقد - تست هوش مصنوعی",
        branchId: 1,
        items: [
            {
                moinCode: "111003", // صندوق (بدهکار می‌شود)
                amount: 1000000,
                type: "Debtor",
                description: "واریز به صندوق"
            },
            {
                moinCode: "111005", // طرف حساب (بستانکار می‌شود)
                amount: 1000000,
                type: "Creditor",
                description: "بابت واریز وجه"
            }
        ]
    };
    await executeTest(depositVoucher);

    // --- سناریو ۲: ثبت سند برداشت ---
    console.log("\n--- 2. Testing WITHDRAWAL (برداشت) ---");
    const withdrawalVoucher = {
        mode: "Withdrawal",
        description: "سند برداشت وجه - طبق فایل نمونه",
        branchId: 1,
        items: [
            {
                moinCode: "111005", // طرف حساب (بدهکار می‌شود)
                amount: 500000,
                type: "Debtor",
                description: "برداشت"
            },
            {
                moinCode: "111003", // صندوق (بستانکار می‌شود)
                amount: 500000,
                type: "Creditor",
                description: "برداشت از صندوق"
            }
        ]
    };
    await executeTest(withdrawalVoucher);
}

// اصلاح تایپ‌ها در اینجا:
async function executeTest(data: any) { // ۱. نوع داده ورودی را any تعریف کردیم (یا اینترفیس دقیق بسازید)
    try {
        const result = await syncToRahkaranSystem(data);
        if (result.success) {
            console.log("✅ SUCCESS! Voucher ID:", result.docId);
        } else {
            console.error("❌ FAILED:", result.error);
        }
    } catch (err: any) { // ۲. نوع خطا را any تعریف کردیم تا بتوانیم به .message دسترسی داشته باشیم
        console.error("❌ ERROR:", err.message);
    }
}

runTests();