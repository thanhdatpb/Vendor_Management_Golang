<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Vendor;

class VendorSeeder extends Seeder {
    public function run(): void {
        $vendors = [
            ['name' => 'Apple Vietnam', 'phone' => '0901234567', 'category' => 'Electronics', 'email' => 'apple@vn.com'],
            ['name' => 'Samsung VN',    'phone' => '0912345678', 'category' => 'Electronics', 'email' => 'samsung@vn.com'],
            ['name' => 'Logitech Asia', 'phone' => '0923456789', 'category' => 'Accessories', 'email' => 'logi@asia.com'],
            ['name' => 'Sony VN',       'phone' => '0934567890', 'category' => 'Audio',       'email' => 'sony@vn.com'],
        ];
        foreach ($vendors as $v) Vendor::create($v);
    }
}