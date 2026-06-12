<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$password = Hash::make('Happyc123@');
$results = [];

// 1. Admin
$admin = User::updateOrCreate(
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

// 2. Vendor (Staff B)
$vendor = User::updateOrCreate(
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

// 3. Sellers (Staff A)
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

echo json_encode([
    'status' => 'success',
    'message' => 'Đã cập nhật toàn bộ tài khoản thành công với mật khẩu Happyc123@',
    'details' => $results
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
