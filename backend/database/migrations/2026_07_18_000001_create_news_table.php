<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bảng "Thông báo" do Vendor (tên cũ: Staff B) tạo trong màn Quản Lý Thông Báo.
     * Trước đây danh sách này chỉ nằm trong localStorage (key STAFF_B_NEWS_V1) của
     * riêng máy Vendor — Vendor đổi máy/trình duyệt là mất sạch danh sách quản lý.
     * (Việc fan-out thành notification chuông cho Admin/Seller vẫn tạm giữ nguyên
     * cơ chế pushNotif hiện tại — không đổi trong phần này.)
     */
    public function up(): void
    {
        Schema::create('news', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('message');
            // 'admin' | 'seller' | 'both' | mảng tên project (JSON), vd ["Happy Project"]
            $table->json('target')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('news');
    }
};
