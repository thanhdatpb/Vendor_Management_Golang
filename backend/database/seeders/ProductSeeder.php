<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Product;

class ProductSeeder extends Seeder {
    public function run(): void {
        // Không tạo sản phẩm mẫu để môi trường sạch sẽ 100%
        // $products = [
        //     ['product_type'=>'Electronics', ...],
        // ];
        // foreach ($products as $p) Product::create($p);
    }
}