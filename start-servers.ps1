# TechStore - Start Both Servers
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TechStore - Khoi dong servers..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start Backend
Write-Host "[1/2] Khoi dong Backend (Laravel)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\Downloads\TechStore\backend'; Write-Host 'Backend starting...' -ForegroundColor Green; php artisan serve --host=0.0.0.0 --port=8000"

Start-Sleep -Seconds 3

# Start Frontend  
Write-Host "[2/2] Khoi dong Frontend (Vite)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Admin\Downloads\TechStore\frontend'; Write-Host 'Frontend starting...' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 5

# Open browser
Write-Host ""
Write-Host "Mo trinh duyet..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "DONE! Truy cap: http://localhost:5173" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
