<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Laravel\Sanctum\HasApiTokens;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable {
    use HasApiTokens, HasFactory, Notifiable;
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'avatar',
        'is_active',
        'seller_name',
        'full_name',
        'project',
        'google_id',
        'avatar_url',
    ];
    
    protected $hidden   = ['password', 'remember_token'];
    protected $casts    = [
        'is_active' => 'boolean', 
        'last_login_at' => 'datetime'
    ];

    public function isAdmin(): bool { 
        return $this->role === 'admin'; 
    }
    
    public function isStaff(): bool { 
        return in_array($this->role, ['staff', 'staff_a', 'staff_b']);
    }
    
    // ← THÊM CÁC HÀM NÀY (phía dưới)
    
    /**
     * Kiểm tra user có phải Staff A (Seller) không
     */
    public function isStaffA(): bool {
        return $this->role === 'staff_a';
    }
    
    /**
     * Kiểm tra user có phải Staff B không
     */
    public function isStaffB(): bool {
        return $this->role === 'staff_b';
    }

    /**
     * Kiểm tra user có phải PD (Product Design) không
     */
    public function isPd(): bool {
        return $this->role === 'pd';
    }

    /**
     * Kiểm tra user có phải CSF (Customer Service & Fulfillment) không
     */
    public function isCsf(): bool {
        return $this->role === 'csf';
    }
    
    /**
     * Trích xuất tên seller từ email
     * Ví dụ: phuoc.huynh.seller@gmail.com -> Phuoc Huynh
     */
    public static function extractSellerNameFromEmail($email)
    {
        $emailPrefix = explode('@', $email)[0];
        $nameParts = explode('.', $emailPrefix);
        
        // Loại bỏ "seller" nếu có ở cuối
        if (strtolower(end($nameParts)) === 'seller') {
            array_pop($nameParts);
        }
        
        // Viết hoa chữ cái đầu
        $sellerName = collect($nameParts)
            ->map(fn($part) => ucfirst(strtolower($part)))
            ->join(' ');
            
        return $sellerName;
    }
    
    /**
     * Lấy tên hiển thị (ưu tiên seller_name, nếu không thì name)
     */
    public function getDisplayNameAttribute()
    {
        return $this->seller_name ?? $this->name ?? $this->email;
    }
}