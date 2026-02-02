// pdfjs.d.ts یا global.d.ts

/**
 * اعلام ماژول برای مسیر خاص pdf.min.mjs
 * این کار خطای 'Cannot find module' را هنگام استفاده از dynamic import رفع می کند.
 */
declare module 'pdfjs-dist/build/pdf.min.mjs';

// برای اطمینان، مسیر اصلی و legacy را نیز اعلام کنید
declare module 'pdfjs-dist/build/pdf';
declare module 'pdfjs-dist/legacy/build/pdf';