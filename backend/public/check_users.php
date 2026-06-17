<?php
header('Content-Type: application/json');
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';

$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$users = \App\Models\User::select('id', 'name', 'email', 'role')->get();

echo json_encode([
    'total_users' => $users->count(),
    'users' => $users
], JSON_PRETTY_PRINT);
