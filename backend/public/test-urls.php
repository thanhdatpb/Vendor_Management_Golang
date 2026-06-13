<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->handle(Illuminate\Http\Request::capture());

$vendors = \App\Models\Vendor::all();
echo "<h1>Vendor Media URLs:</h1>";
echo "<table border='1' cellpadding='10'>";
echo "<tr><th>ID</th><th>Name</th><th>Media URL</th><th>Media URLs Array</th></tr>";
foreach ($vendors as $vendor) {
    echo "<tr>";
    echo "<td>" . $vendor->id . "</td>";
    echo "<td>" . $vendor->vendor_name . "</td>";
    echo "<td>" . $vendor->media_url . "</td>";
    echo "<td>" . json_encode($vendor->media_urls) . "</td>";
    echo "</tr>";
}
echo "</table>";
