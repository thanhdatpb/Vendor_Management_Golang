<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Models\Product;
use App\Models\Notification;
use App\Models\User;

class EventServiceProvider extends ServiceProvider
{
    public function boot()
    {
        // Lắng nghe sự kiện tạo mới Product
        Product::created(function ($product) {
            // Chỉ gửi notification nếu product đang ở trạng thái pending
            if ($product->status === 'pending') {
                $this->sendNotificationToAdmins($product);
            }
        });
    }
    
    private function sendNotificationToAdmins($product)
    {
        // Lấy tất cả Admin
        $admins = User::where('role', 'admin')->get();
        
        if ($admins->isEmpty()) return;
        
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'type' => 'new_form',
                'title' => '📋 Form mới từ Seller',
                'body' => "Seller {$product->seller_name} đã gửi form mới: {$product->product_type} - Project: {$product->project}",
                'is_read' => false,
                'data' => json_encode([
                    'product_id' => $product->id,
                    'product_type' => $product->product_type,
                    'project' => $product->project,
                    'seller_name' => $product->seller_name,
                    'timestamp' => now()->toISOString()
                ])
            ]);
        }
    }
}