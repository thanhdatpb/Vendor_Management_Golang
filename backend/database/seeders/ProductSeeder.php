<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Product;

class ProductSeeder extends Seeder {
    public function run(): void {
        $products = [
            ['product_type'=>'Electronics','media_url'=>'','production_time'=>'2 weeks','shipping_time'=>'3 days','total_cost'=>0,'material'=>'Aluminum','print_area'=>'','other_specs'=>'','good_review'=>'','bad_review'=>'','packaging_links'=>'','other_packaging'=>'','vendor_id'=>1],
            ['product_type'=>'Accessories','media_url'=>'','production_time'=>'1 week','shipping_time'=>'2 days','total_cost'=>0,'material'=>'Plastic','print_area'=>'','other_specs'=>'','good_review'=>'','bad_review'=>'','packaging_links'=>'','other_packaging'=>'','vendor_id'=>1],
            ['product_type'=>'Furniture','media_url'=>'','production_time'=>'4 weeks','shipping_time'=>'1 week','total_cost'=>0,'material'=>'Wood','print_area'=>'','other_specs'=>'','good_review'=>'','bad_review'=>'','packaging_links'=>'','other_packaging'=>'','vendor_id'=>1],
        ];
        foreach ($products as $p) Product::create($p);
    }
}