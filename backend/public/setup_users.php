<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

$password = Hash::make('Happyc123@');
$results = [];

// Danh sách các email ĐƯỢC PHÉP GIỮ LẠI (Chính xác 6 tài khoản theo yêu cầu)
$allowedEmails = [
    'happyc.admin',
    'happyc.vendor',
    'happyc.seller.creative',
    'happyc.seller.happy',
    'happyc.seller.pilot',
    'happyc.seller.global'
];

try {
    DB::beginTransaction();

    // 1. XOÁ TOÀN BỘ CÁC TÀI KHOẢN CŨ KHÔNG NẰM TRONG DANH SÁCH MỚI
    $deletedCount = User::whereNotIn('email', $allowedEmails)->delete();
    $results[] = "Đã dọn dẹp và xoá {$deletedCount} tài khoản rác/cũ khỏi hệ thống.";

    // 2. Cập nhật hoặc tạo mới Admin
    User::updateOrCreate(
        ['email' => 'happyc.admin'],
        [
            'name' => 'Admin',
            'password' => $password,
            'role' => 'admin',
            'full_name' => 'Admin',
            'is_active' => true,
        ]
    );
    $results[] = "Đã cập nhật Admin: happyc.admin";

    // 3. Cập nhật hoặc tạo mới Vendor (Staff B)
    User::updateOrCreate(
        ['email' => 'happyc.vendor'],
        [
            'name' => 'Chị Uyên',
            'password' => $password,
            'role' => 'staff_b',
            'full_name' => 'Uyên Ho',
            'is_active' => true,
        ]
    );
    $results[] = "Đã cập nhật Vendor: happyc.vendor";

    // 4. Cập nhật hoặc tạo mới Sellers (Staff A)
    $sellers = [
        'happyc.seller.creative' => 'Seller Creative',
        'happyc.seller.happy' => 'Seller Happy',
        'happyc.seller.pilot' => 'Seller Pilot',
        'happyc.seller.global' => 'Seller Global',
    ];

    foreach ($sellers as $email => $name) {
        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => $password,
                'role' => 'staff_a',
                'seller_name' => $name,
                'full_name' => $name,
                'is_active' => true,
            ]
        );
        $results[] = "Đã cập nhật Seller: $email";
    }

    DB::commit();

    echo json_encode([
        'status' => 'success',
        'message' => 'Đã RESET TOÀN BỘ hệ thống về chính xác 6 tài khoản chuẩn!',
        'details' => $results
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (\Exception $e) {
    DB::rollBack();
    echo json_encode([
        'status' => 'error',
        'message' => 'Có lỗi xảy ra, có thể do tài khoản cũ đang chứa dữ liệu sản phẩm. Chi tiết: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
