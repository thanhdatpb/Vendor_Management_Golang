<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Sau khi cho phép 1 email có nhiều dòng user (mỗi role/project 1 dòng),
     * cùng một danh tính Google phải gắn được vào TẤT CẢ các dòng đó. Nhưng
     * google_id đang là UNIQUE → login Google lỗi 500
     * (Duplicate entry '...' for key 'google_id').
     *
     * Bỏ unique, thay bằng index thường (tra cứu theo google_id vẫn nhanh).
     * Tính hợp lệ vẫn được đảm bảo ở tầng ứng dụng: SocialAuthController chỉ gắn
     * google_id cho các dòng CÙNG email đã được Google xác minh.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_google_id_unique');
            $table->index('google_id', 'users_google_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_google_id_index');
            // Lưu ý: nếu đã có google_id trùng (1 người nhiều vai trò), thêm lại
            // unique sẽ lỗi — cần dọn dữ liệu trước khi rollback.
            $table->unique('google_id', 'users_google_id_unique');
        });
    }
};
