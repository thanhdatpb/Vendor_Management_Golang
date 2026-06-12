<?php
header('Content-Type: application/json');

$response = [
    'php_version' => phpversion(),
    'vendor_exists' => file_exists(__DIR__ . '/../vendor/autoload.php'),
    'env_exists' => file_exists(__DIR__ . '/../.env'),
    'storage_writable' => is_writable(__DIR__ . '/../storage'),
    'bootstrap_cache_writable' => is_writable(__DIR__ . '/../bootstrap/cache'),
];

if (!$response['vendor_exists']) {
    $response['error'] = 'Thư mục vendor không tồn tại! Bạn chưa up folder vendor lên Hostinger.';
} elseif (!$response['env_exists']) {
    $response['error'] = 'File .env không tồn tại! Bạn chưa đổi tên .env.production thành .env.';
} else {
    try {
        require __DIR__ . '/../vendor/autoload.php';
        $app = require_once __DIR__ . '/../bootstrap/app.php';
        
        // Cố gắng load Database để test
        $app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
        \Illuminate\Support\Facades\DB::connection()->getPdo();
        $response['db'] = 'Kết nối Database thành công!';
    } catch (\Exception $e) {
        $response['error'] = $e->getMessage();
    }
}

echo json_encode($response);
