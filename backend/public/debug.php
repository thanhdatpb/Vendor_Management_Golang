<?php
// Debug script - xóa sau khi debug xong
echo "<h1>Debug Info</h1>";
echo "<h2>1. Thư mục storage/app/vendors:</h2>";
$dir1 = __DIR__ . '/../storage/app/vendors/';
if (is_dir($dir1)) {
    $files = array_diff(scandir($dir1), ['.', '..']);
    if ($files) {
        echo "<ul>";
        foreach ($files as $f) echo "<li>$f (" . filesize($dir1.$f) . " bytes)</li>";
        echo "</ul>";
    } else {
        echo "<p>Thư mục trống (chưa có ảnh nào!)</p>";
    }
} else {
    echo "<p style='color:red'>❌ Thư mục storage/app/vendors/ KHÔNG TỒN TẠI</p>";
}

echo "<h2>2. Thư mục uploads/vendors (public):</h2>";
$dir2 = __DIR__ . '/uploads/vendors/';
if (is_dir($dir2)) {
    $files = array_diff(scandir($dir2), ['.', '..']);
    if ($files) {
        echo "<ul>";
        foreach ($files as $f) echo "<li>$f (" . filesize($dir2.$f) . " bytes)</li>";
        echo "</ul>";
    } else {
        echo "<p>Thư mục trống</p>";
    }
} else {
    echo "<p>Thư mục uploads/vendors/ không tồn tại</p>";
}

echo "<h2>3. __DIR__ (vị trí thư mục public):</h2>";
echo "<p>" . __DIR__ . "</p>";

echo "<h2>4. Kiểm tra media.php:</h2>";
echo "<p>Thử truy cập: <a href='/media.php?f=test' target='_blank'>/media.php?f=test</a></p>";
