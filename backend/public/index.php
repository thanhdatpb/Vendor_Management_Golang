<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

if (isset($_GET['clearcache']) && $_GET['clearcache'] == '1') {
    $cacheDir = __DIR__.'/../bootstrap/cache/';
    $files = ['routes.php', 'config.php', 'services.php', 'packages.php', 'events.php'];
    $deleted = [];
    foreach ($files as $file) {
        if (file_exists($cacheDir . $file)) {
            @unlink($cacheDir . $file);
            $deleted[] = $file;
        }
    }
    die('<h1>✅ Đã xóa Cache Backend thành công!</h1><p>Đã xóa các file: ' . implode(', ', $deleted) . '</p><p>Bạn có thể đóng trang này và kiểm tra lại chức năng trên trang web.</p>');
}

$app->handleRequest(Request::capture());
