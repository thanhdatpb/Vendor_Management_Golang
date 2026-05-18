<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;

class SellerProjectSeeder extends Seeder
{
    public function run(): void
    {
        $mappings = [
            'phuoc.huynh.seller@gmail.com' => 'Creative Project',
            'tran.hoang.seller@gmail.com' => 'Happy Project',
            'sang.han.seller@gmail.com' => 'Happy Project',
            'quy.hoang.seller@gmail.com' => 'Happy Project',
            'hien.nguyen.seller@gmail.com' => 'Global Project',
            'hang.le.seller@gmail.com' => 'Global Project',
            'minh.pham.seller@gmail.com' => 'Global Project',
            'tin.nguyen.seller@gmail.com' => 'Global Project',      
            'trang.ho.seller@gmail.com' => 'Creative Project',
            'luan.nguyen.seller@gmail.com' => 'Creative Project',
            'nhi.hoang.seller@gmail.com' => 'Pilot Project',        
            'anh.dau.seller@gmail.com' => 'Pilot Project',          
        ];

        foreach ($mappings as $email => $project) {
            User::where('email', $email)->update(['project' => $project]);
        }

        $this->command->info('✅ Đã gán Project cho ' . count($mappings) . ' sellers');
        
        // Hiển thị kết quả
        $users = User::whereIn('email', array_keys($mappings))->get(['email', 'project']);
        foreach ($users as $user) {
            $this->command->line("📧 {$user->email} → {$user->project}");
        }
    }
}