// test-db.js
const sql = require('mssql');

// 👇 اطلاعات خود را اینجا دقیق وارد کنید
const config = {
    user: 'sa', 
    password: 'Rhyno@1234', // رمز عبوری که در SSMS ست کردید
    server: '127.0.0.1', // یا localhost
    port: 1433, 
    database: 'master', // دیتابیس پیش‌فرض
    options: {
        encrypt: true, // برای لوکال معمولا true مشکلی ندارد ولی اگر ارور SSL داد false کنید
        trustServerCertificate: true // حیاتی برای محیط لوکال
    }
};

async function testConnection() {
    try {
        console.log("⏳ در حال تلاش برای اتصال...");
        console.log(`   Host: ${config.server}`);
        console.log(`   Port: ${config.port}`);
        console.log(`   User: ${config.user}`);

        const pool = await sql.connect(config);
        console.log("✅ اتصال با موفقیت برقرار شد!");
        
        const result = await pool.request().query('SELECT @@VERSION as version');
        console.log("📊 نسخه دیتابیس:", result.recordset[0].version);
        
        await pool.close();
    } catch (err) {
        console.error("❌ خطا در اتصال:");
        console.error("---------------------------------------------------");
        console.error("پیام خطا:", err.message);
        console.error("کد خطا:", err.code);
        console.error("---------------------------------------------------");
        
        if (err.code === 'ESOCKET') {
            console.log("💡 راهنمایی: این خطا یعنی پورت 1433 بسته است یا SQL Server روی آن گوش نمی‌دهد.");
            console.log("   - آیا سرویس SQL Server را بعد از تنظیمات Restart کردید؟");
            console.log("   - آیا TCP/IP در SQL Configuration Manager فعال شده؟");
        } else if (err.code === 'ELOGIN') {
            console.log("💡 راهنمایی: نام کاربری یا رمز عبور اشتباه است.");
            console.log("   - آیا یوزر sa فعال (Enable) شده است؟");
            console.log("   - آیا تیک Mixed Mode Authentication را زده‌اید؟");
        }
    }
}

testConnection();