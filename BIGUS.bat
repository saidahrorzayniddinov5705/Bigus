@echo off
chcp 65001 >nul
title BIGUS server
cd /d "%~dp0"
echo BIGUS ishga tushirilmoqda...
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
start "" http://localhost:4000
echo.
echo Sayt:        http://localhost:4000
echo Admin panel: http://localhost:4000/#/admin
echo Bu oynani yopsangiz, sayt ham to'xtaydi.
echo.
call npx tsx server/index.ts
pause
