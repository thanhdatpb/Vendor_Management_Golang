<?php
/**
 * Fallback file server for /storage/ requests when the storage symlink
 * (public/storage -> storage/app/public) is not available on the server.
 * The .htaccess routes /storage/{path} here only when the symlink is absent.
 */
$path = $_GET['path'] ?? '';

// Block directory traversal and disallow chars outside safe set
if (!$path || str_contains($path, '..') || preg_match('/[^a-zA-Z0-9_.\-\/]/', $path)) {
    http_response_code(400);
    exit('Invalid path');
}

$file = dirname(__DIR__) . '/storage/app/public/' . ltrim($path, '/');

if (!file_exists($file) || !is_file($file)) {
    http_response_code(404);
    exit('Not found');
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
$mimes = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'gif'  => 'image/gif',
    'webp' => 'image/webp',
    'svg'  => 'image/svg+xml',
    'mp4'  => 'video/mp4',
    'webm' => 'video/webm',
    'mov'  => 'video/quicktime',
];
$mime = $mimes[$ext] ?? 'application/octet-stream';

header('Content-Type: ' . $mime);
header('Cache-Control: public, max-age=86400');
header('Content-Length: ' . filesize($file));
header('Access-Control-Allow-Origin: *');
readfile($file);
exit;
