<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Load server-specific env overrides from a file outside the git repo.
// Try multiple candidate paths to handle open_basedir restrictions.
$_envCandidates = [
    dirname(__DIR__, 5) . '/.env.server',  // /home/u.../
    dirname(__DIR__, 4) . '/.env.server',  // /home/u.../domains/
    dirname(__DIR__, 3) . '/.env.server',  // /home/u.../domains/domain.com/
    dirname(__DIR__, 2) . '/.env.server',  // /home/.../public_html/
    dirname(__DIR__, 1) . '/.env.server',  // backend/
];
foreach ($_envCandidates as $_serverEnvFile) {
    if (@file_exists($_serverEnvFile) && @is_readable($_serverEnvFile)) {
        foreach (@parse_ini_file($_serverEnvFile) ?: [] as $_k => $_v) {
            if (!array_key_exists($_k, $_ENV)) {
                $_ENV[$_k] = $_v;
                $_SERVER[$_k] = $_v;
                putenv("$_k=$_v");
            }
        }
        break;
    }
}
unset($_envCandidates, $_serverEnvFile, $_k, $_v);

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
