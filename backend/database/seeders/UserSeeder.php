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
            ['email' => 'admin@gmail.com'],
            [
                'name'       => 'Admin',
                'password'   => Hash::make('123456'),  // ← sửa thành 123456
                'role'       => 'admin',
                'seller_name'=> null,
                'full_name'  => 'Admin',
                'is_active'  => true,
            ]
        );
        
        // Xóa tài khoản admin cũ nếu còn
        User::where('email', 'admin@techstore.vn')->delete();
        $this->command->info('✅ Admin: admin@gmail.com / 123456');

        // ========== 2. TÀI KHOẢN STAFF B ==========
        User::where('email', 'staffb@gmail.com')->delete();
        
        User::updateOrCreate(
            ['email' => 'uyenho.vendor@gmail.com'],
            [
                'name'       => 'Uyen Ho',
                'password'   => Hash::make('123456'),
                'role'       => 'staff_b',
                'seller_name'=> null,
                'full_name'  => 'Ho Uyen',
                'is_active'  => true,
            ]
        );
        $this->command->info('✅ Staff B: uyenho.vendor@gmail.com / 123456');

        // ========== 3. CẬP NHẬT TÀI KHOẢN staff@techstore.vn (cũ) ==========
        $oldStaff = User::where('email', 'staff@techstore.vn')->first();
        if ($oldStaff) {
            $oldStaff->update([
                'email'      => 'phuoc.huynh.seller@gmail.com',
                'name'       => 'Phuoc Huynh',
                'role'       => 'staff_a',
                'seller_name'=> 'Phuoc Huynh',
                'full_name'  => 'Huynh Phuoc',
            ]);
            $this->command->info('✅ Updated: staff@techstore.vn -> phuoc.huynh.seller@gmail.com');
        } else {
            User::updateOrCreate(
                ['email' => 'phuoc.huynh.seller@gmail.com'],
                [
                    'name'       => 'Phuoc Huynh',
                    'password'   => Hash::make('123456'),
                    'role'       => 'staff_a',
                    'seller_name'=> 'Phuoc Huynh',
                    'full_name'  => 'Huynh Phuoc',
                    'is_active'  => true,
                ]
            );
        }

        // ========== 4. DANH SÁCH 9 TÀI KHOẢN STAFF A ==========
        $staffAccounts = [
            ['email' => 'tran.hoang.seller@gmail.com', 'name' => 'Tran Hoang'],
            ['email' => 'sang.han.seller@gmail.com',   'name' => 'Sang Han'],
            ['email' => 'quy.hoang.seller@gmail.com',  'name' => 'Quy Hoang'],
            ['email' => 'hien.nguyen.seller@gmail.com','name' => 'Hien Nguyen'],
            ['email' => 'hang.le.seller@gmail.com',    'name' => 'Hang Le'],
            ['email' => 'minh.pham.seller@gmail.com',  'name' => 'Minh Pham'],
            ['email' => 'tin.nguyen.seller@gmail.com', 'name' => 'Tin Nguyen'],
            ['email' => 'trang.ho.seller@gmail.com',   'name' => 'Trang Ho'],
            ['email' => 'luan.nguyen.seller@gmail.com','name' => 'Luan Nguyen'],
        ];

        foreach ($staffAccounts as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name'       => $account['name'],
                    'password'   => Hash::make('123456'),
                    'role'       => 'staff_a',
                    'seller_name'=> $account['name'],
                    'full_name'  => $account['name'],
                    'is_active'  => true,
                ]
            );
            $this->command->info("✅ Created: {$account['email']} - {$account['name']}");
        }

        $this->command->info("\n🎉 UserSeeder completed!");
        $this->command->info("📋 DANH SÁCH TÀI KHOẢN (TẤT CẢ ĐỀU CÓ MẬT KHẨU: 123456)");
        $this->command->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        $this->command->info("🔴 Admin:     admin@gmail.com");
        $this->command->info("🟡 Staff B:   uyenho.vendor@gmail.com");
        $this->command->info("🟢 Staff A:   10 sellers:");
        $this->command->info("   - phuoc.huynh.seller@gmail.com");
        $this->command->info("   - tran.hoang.seller@gmail.com");
        $this->command->info("   - sang.han.seller@gmail.com");
        $this->command->info("   - quy.hoang.seller@gmail.com");
        $this->command->info("   - hien.nguyen.seller@gmail.com");
        $this->command->info("   - hang.le.seller@gmail.com");
        $this->command->info("   - minh.pham.seller@gmail.com");
        $this->command->info("   - tin.nguyen.seller@gmail.com");
        $this->command->info("   - trang.ho.seller@gmail.com");
        $this->command->info("   - luan.nguyen.seller@gmail.com");
        $this->command->info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
}