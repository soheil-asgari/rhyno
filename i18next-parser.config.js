module.exports = {
    locales: ['en', 'fa'],  // زبان‌ها
    output: 'locales/$LOCALE/$NAMESPACE.json',  // مسیر خروجی فایل‌های ترجمه
    input: [
        'app/**/*.{js,jsx,ts,tsx}',  // مسیرهای مختلف پروژه
        'components/**/*.{js,jsx,ts,tsx}',
        'public/**/*.{js,jsx,ts,tsx}',
    ],
};
