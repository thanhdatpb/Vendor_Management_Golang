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
    /**
     * Cả up() lẫn down() đều phải kiểm tra index có thật hay không trước khi
     * đụng vào.
     *
     * Lý do: trên production, unique `users_google_id_unique` đã được gỡ TAY qua
     * phpMyAdmin để chữa gấp lỗi 500 login Google, trước khi migration này kịp
     * chạy. Bản cũ gọi thẳng dropUnique() nên nổ
     * "1091 Can't DROP INDEX ...; check that it exists" → `php artisan migrate`
     * abort tại đây và MỌI migration phía sau không bao giờ chạy (chính là cách
     * bản vá cột products.total_cost bị kẹt lại, khiến lỗi "Data truncated" trên
     * production kéo dài dù code đã merge).
     */
    public function up(): void
    {
        $indexes = collect(Schema::getIndexes('users'))->pluck('name');

        Schema::table('users', function (Blueprint $table) use ($indexes) {
            if ($indexes->contains('users_google_id_unique')) {
                $table->dropUnique('users_google_id_unique');
            }
            if (!$indexes->contains('users_google_id_index')) {
                $table->index('google_id', 'users_google_id_index');
            }
        });
    }

    public function down(): void
    {
        $indexes = collect(Schema::getIndexes('users'))->pluck('name');

        Schema::table('users', function (Blueprint $table) use ($indexes) {
            if ($indexes->contains('users_google_id_index')) {
                $table->dropIndex('users_google_id_index');
            }
            // Lưu ý: nếu đã có google_id trùng (1 người nhiều vai trò), thêm lại
            // unique sẽ lỗi — cần dọn dữ liệu trước khi rollback.
            if (!$indexes->contains('users_google_id_unique')) {
                $table->unique('google_id', 'users_google_id_unique');
            }
        });
    }
};
