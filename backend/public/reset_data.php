<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

try {
    // Tắt kiểm tra khoá ngoại để có thể xoá dữ liệu mà không bị lỗi ràng buộc
    Schema::disableForeignKeyConstraints();

    // Xoá sạch toàn bộ dữ liệu trong các bảng sau (Reset Data)
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

    echo json_encode([
        'status' => 'success',
        'message' => 'Đã dọn dẹp SẠCH SẼ toàn bộ dữ liệu thư viện Vendor, Sản phẩm và Đơn hàng cũ! Hệ thống đã sẵn sàng đón dữ liệu chuẩn mới.'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (\Exception $e) {
    Schema::enableForeignKeyConstraints();
    
    echo json_encode([
        'status' => 'error',
        'message' => 'Lỗi khi dọn dẹp dữ liệu: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
