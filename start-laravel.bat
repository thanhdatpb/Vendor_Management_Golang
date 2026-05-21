@echo off
title Laravel Backend - TechStore
cd /d C:\Users\Admin\Downloads\TechStore\backend
echo ==========================================
echo   Starting Laravel Backend...
echo   Host: 0.0.0.0  Port: 8000
echo ==========================================
echo.
php -S 0.0.0.0:8000 -t public
echo.
echo Laravel has stopped. Press any key to restart...
pause
