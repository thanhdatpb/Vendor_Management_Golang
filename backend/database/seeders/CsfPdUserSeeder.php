<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class CsfPdUserSeeder extends Seeder {
    public function run(): void {

        // ========== TÀI KHOẢN PD (Product Design) — mỗi PD gắn 1 project ==========
        $pdAccounts = [
            ['email' => 'hc.pd.happy',    'name' => 'PD Happy Project',    'project' => 'Happy Project'],
            ['email' => 'hc.pd.creative', 'name' => 'PD Creative Project', 'project' => 'Creative Project'],
            ['email' => 'hc.pd.global',   'name' => 'PD Global Project',   'project' => 'Global Project'],
            ['email' => 'hc.pd.hapify84', 'name' => 'PD Hapify84 Project', 'project' => 'Hapify84 Project'],
        ];

        foreach ($pdAccounts as $account) {
            User::updateOrCreate(
                ['email' => $account['email']],
                [
                    'name'       => $account['name'],
                    'password'   => Hash::make('Happyc123@'),
                    'role'       => 'pd',
                    'seller_name'=> null,
                    'full_name'  => $account['name'],
                    'project'    => $account['project'],
                    'is_active'  => true,
                ]
            );
            $this->command->info("✅ Created PD: {$account['email']} - {$account['name']}");
        }

        // ========== TÀI KHOẢN CSF (Customer Service & Fulfillment) — xem nhiều project ==========
        User::updateOrCreate(
            ['email' => 'hc.csf'],
            [
                'name'       => 'CSF',
                'password'   => Hash::make('Happyc123@'),
                'role'       => 'csf',
                'seller_name'=> null,
                'full_name'  => 'CSF',
                'project'    => null,
                'is_active'  => true,
            ]
        );
        $this->command->info('✅ Created CSF: hc.csf');

        $this->command->info("\n🎉 CsfPdUserSeeder completed! (Mật khẩu: Happyc123@)");
    }
}
