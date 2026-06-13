<?php
// File này giúp chạy lệnh xóa Cache trên Shared Hosting (Hostinger, cPanel)
// Mở trình duyệt và truy cập: domain.com/clear-cache.php

require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

// Bắt đầu ứng dụng Laravel
$kernel->handle(Illuminate\Http\Request::capture());

echo "<h1>Đang tiến hành dọn dẹp Cache Hệ thống...</h1>";

try {
    \Illuminate\Support\Facades\Artisan::call('optimize:clear');
    echo "<p style='color: green; font-weight: bold;'>✅ Đã xóa toàn bộ Cache thành công (Routes, Config, Views, Cache)!</p>";
    echo "<p>Bạn có thể quay lại trang quản trị và kiểm tra lại phần Hình ảnh.</p>";
} catch (\Exception $e) {
    echo "<p style='color: red;'>❌ Lỗi khi xóa cache: " . $e->getMessage() . "</p>";
}
