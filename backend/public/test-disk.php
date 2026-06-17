<?php
$dir = __DIR__ . '/../storage/app/vendors/';
if (!is_dir($dir)) {
    die("<h1>Thư mục storage/app/vendors không tồn tại!</h1>");
}

$files = array_diff(scandir($dir), array('.', '..'));
echo "<h1>Danh sách file đã Upload:</h1>";
if (empty($files)) {
    echo "<p>Chưa có file nào trong thư mục này!</p>";
} else {
    echo "<ul>";
    foreach ($files as $file) {
        $size = filesize($dir . $file);
        echo "<li>$file (" . round($size / 1024, 2) . " KB)</li>";
    }
    echo "</ul>";
}
