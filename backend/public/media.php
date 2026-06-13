<?php
$f = $_GET['f'] ?? '';
// Basic security check to prevent directory traversal
if (!$f || preg_match('/[^a-zA-Z0-9_\.-]/', $f)) {
    http_response_code(400);
    die('Invalid file name');
}

$path = __DIR__ . '/../storage/app/vendors/' . $f;

if (!file_exists($path)) {
    http_response_code(404);
    die('File not found');
}

$mime = 'image/jpeg';
$f_lower = strtolower($f);
if (str_ends_with($f_lower, '.png')) $mime = 'image/png';
if (str_ends_with($f_lower, '.gif')) $mime = 'image/gif';
if (str_ends_with($f_lower, '.webp')) $mime = 'image/webp';
if (str_ends_with($f_lower, '.mp4')) $mime = 'video/mp4';
if (str_ends_with($f_lower, '.webm')) $mime = 'video/webm';

header('Content-Type: ' . $mime);
header('Cache-Control: public, max-age=86400');
header('Content-Length: ' . filesize($path));
readfile($path);
exit;
