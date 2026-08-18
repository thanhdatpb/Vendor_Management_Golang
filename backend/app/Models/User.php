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
        // `last_login_at` từng được khai ở đây nhưng KHÔNG có cột nào trong DB
        // và không chỗ nào ghi. Thay bằng cột thật `last_seen_at` — mốc thao
        // tác gần nhất, do middleware TouchLastSeen cập nhật.
        'last_seen_at' => 'datetime',
    ];

    public function isAdmin(): bool { 
        return $this->role === 'admin'; 
    }
    
    public function isStaff(): bool {
        return $this->role === 'staff' || $this->isSeller() || $this->isVendor();
    }

    /**
     * Kiểm tra user có phải Seller (tên cũ: Staff A) không
     */
    public function isSeller(): bool {
        return in_array($this->role, ['seller', 'staff_a']);
    }

    /**
     * Kiểm tra user có phải Vendor (tên cũ: Staff B) không
     */
    public function isVendor(): bool {
        return in_array($this->role, ['vendor', 'staff_b']);
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
     * Kiểm tra user có phải Marvel không.
     * Marvel giống hệt CSF về quyền (xem Thư viện Vendor read-only, ẩn giá,
     * xem được mọi project) — chỉ khác nhãn hiển thị trên UI.
     */
    public function isMarvel(): bool {
        return $this->role === 'marvel';
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