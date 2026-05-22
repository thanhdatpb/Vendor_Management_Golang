@echo off
title TechStore - Starting Servers...
echo ============================================
echo   TechStore - Khoi dong Backend + Frontend
echo ============================================
echo.

:: Start Backend (Laravel) in a new window
echo [1/2] Dang khoi dong Backend (Laravel)...
start "TechStore Backend" cmd /k "cd /d c:\Users\Admin\Downloads\TechStore\backend && php artisan serve --host=0.0.0.0 --port=8000"

:: Wait 3 seconds for backend to start
timeout /t 3 /nobreak >nul

:: Start Frontend (Vite) in a new window
echo [2/2] Dang khoi dong Frontend (Vite)...
start "TechStore Frontend" cmd /k "cd /d c:\Users\Admin\Downloads\TechStore\frontend && npm run dev"

:: Wait 5 seconds for frontend to start
timeout /t 5 /nobreak >nul

:: Open browser
echo.
echo Dang mo trinh duyet...
start http://localhost:5173

echo.
echo ============================================
echo   DONE! Truy cap: http://localhost:5173
echo   Nhan phim bat ky de dong cua so nay...
echo ============================================
pause >nul
