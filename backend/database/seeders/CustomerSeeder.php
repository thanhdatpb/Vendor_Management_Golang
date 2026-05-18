<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Customer;

class CustomerSeeder extends Seeder {
    public function run(): void {
        $customers = [
            ['name' => 'Nguyễn Văn An',  'email' => 'an@email.com',   'phone' => '0901111111'],
            ['name' => 'Trần Thị Bình',  'email' => 'binh@email.com', 'phone' => '0902222222'],
            ['name' => 'Lê Minh Châu',   'email' => 'chau@email.com', 'phone' => '0903333333'],
            ['name' => 'Phạm Quốc Dũng', 'email' => 'dung@email.com', 'phone' => '0904444444'],
            ['name' => 'Hoàng Thị Em',   'email' => 'em@email.com',   'phone' => '0905555555'],
        ];
        foreach ($customers as $c) Customer::create($c);
    }
}
