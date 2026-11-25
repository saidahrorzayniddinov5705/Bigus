@echo off
chcp 65001 >nul
title BIGUS DEMO
cd /d "C:\Users\User\Desktop\Bigus-main\Bigus-main"
echo BIGUS DEMO ishga tushirilmoqda (haqiqiy bazaga tegmaydi)...
if not exist node_modules (
  echo Birinchi marta: kutubxonalar o'rnatilmoqda...
  call npm install
)
echo Sayt yig'ilmoqda (build)...
call npx vite build
if errorlevel 1 (
  echo Build xatosi! Yuqoridagi xabarni o'qing.
  pause
  exit /b 1
)
echo Demo ma'lumotlar bugungi sanaga moslab yangilanmoqda...
call npx tsx server/seed-demo.ts
start "" http://localhost:4100
echo.
echo DEMO sayt:   http://localhost:4100
echo Admin panel: http://localhost:4100/#/admin   (demo@bigus.uz / Demo2026)
echo Demo bemor:  Karimov Aziz Botirovich, 15.01.1980, PIN 123456
echo Bu oynani yopsangiz, demo ham to'xtaydi.
echo.
call npx tsx server/demo.ts
pause
