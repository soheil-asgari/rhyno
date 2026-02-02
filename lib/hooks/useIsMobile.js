// hooks/useIsMobile.js
import { useState, useEffect } from 'react';

// این هوک را برای تشخیص اندازه موبایل اضافه کنید
export const useIsMobile = (breakpoint = 768) => { // 768px معمولاً نقطه بین موبایل/تبلت و دسکتاپ است
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };

        // تنظیم مقدار اولیه هنگام لود شدن صفحه
        handleResize();

        // گوش دادن به تغییرات اندازه صفحه
        window.addEventListener('resize', handleResize);

        // پاکسازی event listener هنگام unmount شدن کامپوننت
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]); // `breakpoint` به عنوان dependency برای اطمینان از به روز رسانی

    return isMobile;
};