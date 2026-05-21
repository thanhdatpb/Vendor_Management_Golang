@echo off
title TechStore - Dev Launcher
echo ==========================================
echo   TechStore Dev Environment Launcher
echo ==========================================
echo.

REM --- Start Laravel Backend in a new window ---
echo [1/2] Starting Laravel Backend on 0.0.0.0:8000...
start "Laravel Backend" cmd /k "cd /d C:\Users\Admin\Downloads\TechStore\backend && php artisan serve --host=0.0.0.0 --port=8000"

REM --- Wait a moment for Laravel to start ---
timeout /t 3 /nobreak >nul

REM --- Start Vite Frontend in a new window ---
echo [2/2] Starting Vite Frontend on 0.0.0.0:5173...
start "Vite Frontend" cmd /k "cd /d C:\Users\Admin\Downloads\TechStore\frontend && npm run dev"

echo.
echo ==========================================
echo   Both services are starting!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo ==========================================
echo.
echo   Share this with your team:
echo   http://192.168.1.19:5173
echo.
echo   Press any key to close this launcher...
echo   (The services will keep running)
pause >nul
