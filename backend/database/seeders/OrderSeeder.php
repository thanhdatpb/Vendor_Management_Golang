<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Order;

class OrderSeeder extends Seeder
{
    public function run(): void
    {
        $orders = [
            [
                'customer_id' => 1,
                'status' => 'completed',
                'total' => 45900000,
                'created_at' => now()->subDays(5)
            ],
            [
                'customer_id' => 2,
                'status' => 'completed',
                'total' => 29900000,
                'created_at' => now()->subDays(4)
            ],
            [
                'customer_id' => 3,
                'status' => 'pending',
                'total' => 18500000,
                'created_at' => now()->subDays(2)
            ],
            [
                'customer_id' => 1,
                'status' => 'cancelled',
                'total' => 6900000,
                'created_at' => now()->subDays(1)
            ]
        ];

        foreach ($orders as $order) {
            Order::create($order);
        }
    }
}