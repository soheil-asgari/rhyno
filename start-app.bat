@echo off
SETLOCAL EnableDelayedExpansion
cd /d "%~dp0"
TITLE Rhyno Finance - System Check

echo [!] Checking for Node.js...

:: بررسی وجود نود
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Node.js NOT found! 
    echo [!] Starting Installation...
    
    :: پیدا کردن فایل نصبی در پوشه موقت یا کنار برنامه
    :: ما فرض میکنیم فایل نصبی نود در پوشه installers کنار این فایل بات است
    if exist "installers\node-v20.20.0-x64.msi" (
        echo [!] Installing Node.js 20.20.0...
        echo [!] PLEASE WAIT: A new window will open for installation.
        :: اجرای نصب به صورت معمولی (غیر سایلنت) تا مراحل را ببینید
        start /wait installers\node-v20.20.0-x64.msi
    ) else (
        echo [X] Error: Installation file (node-v20.20.0-x64.msi) not found in 'installers' folder.
        pause
        exit
    )
    
    echo [!] Installation finished. Updating System Path...
    :: رفرش کردن Path در سشن فعلی
    SET "PATH=%PATH%;C:\Program Files\nodejs\;C:\Program Files (x86)\nodejs\"
)

echo [V] Node.js is ready: 
node -v

echo.
echo [!] Preparing Environment...
:: کپی کردن فایل ورکر
node -e "require('fs').copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/pdf.worker.min.js')"

echo [!] Opening Browser...
start http://localhost:3000/enterprise/login

echo [!] Starting Local Server...
:: اجرای مستقیم برای دیدن ارورهای احتمالی نود
call node_modules\.bin\next start -p 3000
if %errorlevel% neq 0 (
    echo [X] Server failed to start.
    pause
)