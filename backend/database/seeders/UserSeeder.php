<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder {
    public function run(): void {
        
        // ========== 1. TÀI KHOẢN ADMIN ==========
        User::updateOrCreate(
            ['email' => 'happyc.admin'],
            [
                'name'       => 'Admin',
                'password'   => Hash::make('Happyc123@'),
                'role'       => 'admin',
                'seller_name'=> null,
                'full_name'  => 'Admin',
                'is_active'  => true,
            ]
        );
        $this->command->info('✅ Admin: happyc.admin / Happyc123@');

        // ========== 2. TÀI KHOẢN STAFF B (VENDOR) ==========
        User::updateOrCreate(
            ['email' => 'happyc.vendor'],
            [
                'name'       => 'Chị Uyên',
                'password'   => Hash::make('Happyc123@'),
                'role'       => 'staff_b',
                'seller_name'=> null,
                'full_name'  => 'Uyên Ho',
                'is_active'  => true,
            ]
        );
        $this->command->info('✅ Staff B: happyc.vendor / Happyc123@');

        // ========== 3. DANH SÁCH TÀI KHOẢN STAFF A (SELLER) ==========
        $staffAccounts = [
            ['email' => 'happyc.seller.creative', 'name' => 'Seller Creative'],
            ['email' => 'happyc.seller.happy',    'name' => 'Seller Happy'],
            ['email' => 'happyc.seller.pilot',    'name' => 'Seller Pilot'],
            ['email' => 'happyc.seller.global',   'name' => 'Seller Global'],
        ];

        foreach ($staffAccounts as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name'       => $account['name'],
                    'password'   => Hash::make('Happyc123@'),
                    'role'       => 'staff_a',
                    'seller_name'=> $account['name'],
                    'full_name'  => $account['name'],
                    'is_active'  => true,
                ]
            );
            $this->command->info("✅ Created: {$account['email']} - {$account['name']}");
        }

        $this->command->info("\n🎉 UserSeeder completed!");
        $this->command->info("📋 DANH SÁCH TÀI KHOẢN (TẤT CẢ ĐỀU CÓ MẬT KHẨU: Happyc123@)");
        $this->command->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->command->info("🔴 Admin:     happyc.admin");
        $this->command->info("🟡 Staff B:   happyc.vendor");
        $this->command->info("🟢 Staff A:   4 sellers:");
        $this->command->info("   - happyc.seller.creative");
        $this->command->info("   - happyc.seller.happy");
        $this->command->info("   - happyc.seller.pilot");
        $this->command->info("   - happyc.seller.global");
        $this->command->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
}