<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$v1 = new \App\Models\Vendor();
$v1->product_type = 'ABC';
$v1->vendor_type = 'New';
$v1->name = 'A';
$v1->size = '4"';
$v1->save();
echo "Saved A 4.\n";

$v2 = new \App\Models\Vendor();
$v2->product_type = 'ABC';
$v2->vendor_type = 'New';
$v2->name = 'A';
$v2->size = '5"';
$v2->save();
echo "Saved A 5.\n";

echo json_encode(\App\Models\Vendor::where('product_type', 'ABC')->get()->toArray());
