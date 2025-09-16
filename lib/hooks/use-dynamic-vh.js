// lib/hooks/use-dynamic-vh.js
import { useEffect } from 'react';

const useDynamicVh = () => {
    useEffect(() => {
        const setVh = () => {
            // ارتفاع واقعی پنجره را می‌خوانیم
            const vh = window.innerHeight * 0.01;
            // متغیر --vh را در ریشه سند (<html>) قرار می‌دهیم
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        // در اولین بارگذاری و هنگام تغییر سایز پنجره، تابع را اجرا می‌کنیم
        setVh();
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh); // برای چرخش صفحه

        // هنگام خروج از کامپوننت، event listenerها را پاک می‌کنیم
        return () => {
            window.removeEventListener('resize', setVh);
            window.removeEventListener('orientationchange', setVh);
        };
    }, []);
};

export default useDynamicVh;