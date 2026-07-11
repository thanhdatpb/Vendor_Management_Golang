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
            ['email' => 'hc.thinhnguyen'],
            [
                'name'       => 'Admin',
                'password'   => Hash::make('Happyc123@'),
                'role'       => 'admin',
                'seller_name'=> null,
                'full_name'  => 'Admin',
                'is_active'  => true,
            ]
        );
        $this->command->info('✅ Admin: hc.thinhnguyen / Happyc123@');

        // ========== 2. TÀI KHOẢN VENDOR (TÊN CŨ: STAFF B) ==========
        User::updateOrCreate(
            ['email' => 'hc.uyenho'],
            [
                'name'       => 'Uyên Hồ',
                'password'   => Hash::make('Happyc123@'),
                'role'       => 'vendor',
                'seller_name'=> null,
                'full_name'  => 'Uyên Hồ',
                'is_active'  => true,
            ]
        );
        $this->command->info('✅ Vendor: hc.uyenho / Happyc123@');

        // ========== 3. DANH SÁCH TÀI KHOẢN SELLER (TÊN CŨ: STAFF A) ==========
        $staffAccounts = [
            ['email' => 'hc.happy',    'name' => 'Happy Project',    'project' => 'Happy Project'],
            ['email' => 'hc.creative', 'name' => 'Creative Project', 'project' => 'Creative Project'],
            ['email' => 'hc.global',   'name' => 'Global Project',   'project' => 'Global Project'],
            ['email' => 'hc.hapify84', 'name' => 'Hapify84 Project', 'project' => 'Hapify84 Project'],
        ];

        foreach ($staffAccounts as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name'       => $account['name'],
                    'password'   => Hash::make('Happyc123@'),
                    'role'       => 'seller',
                    'seller_name'=> $account['name'],
                    'full_name'  => $account['name'],
                    'project'    => $account['project'],
                    'is_active'  => true,
                ]
            );
            $this->command->info("✅ Created: {$account['email']} - {$account['name']}");
        }

        $this->command->info("\n🎉 UserSeeder completed!");
        $this->command->info("📋 DANH SÁCH TÀI KHOẢN (TẤT CẢ ĐỀU CÓ MẬT KHẨU: Happyc123@)");
        $this->command->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->command->info("🔴 Admin:     hc.thinhnguyen");
        $this->command->info("🟡 Vendor:    hc.uyenho");
        $this->command->info("🟢 Seller:    4 sellers:");
        $this->command->info("   - hc.happy");
        $this->command->info("   - hc.creative");
        $this->command->info("   - hc.global");
        $this->command->info("   - hc.hapify84");
        $this->command->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
}
