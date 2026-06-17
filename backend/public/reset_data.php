<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Cache;

try {
    // Tắt kiểm tra khoá ngoại
    Schema::disableForeignKeyConstraints();

    $tablesToTruncate = [
        'vendors',
        'vendor_details',
        'vendor_comparisons',
        'products',
        'orders',
        'order_items',
        'payments',
        'inventory_logs',
        'notifications',
        'request_vendors'
    ];

    foreach ($tablesToTruncate as $table) {
        if (Schema::hasTable($table)) {
            DB::table($table)->truncate();
        }
    }

    // Bật lại kiểm tra khoá ngoại
    Schema::enableForeignKeyConstraints();

    // XOÁ CACHE (QUAN TRỌNG: Để frontend không hiển thị lại dữ liệu cũ)
    Cache::flush();

    echo json_encode([
        'status' => 'success',
        'message' => 'Đã dọn dẹp SẠCH SẼ dữ liệu và XOÁ CACHE thành công!'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (\Exception $e) {
    Schema::enableForeignKeyConstraints();
    
    echo json_encode([
        'status' => 'error',
        'message' => 'Lỗi khi dọn dẹp dữ liệu: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
