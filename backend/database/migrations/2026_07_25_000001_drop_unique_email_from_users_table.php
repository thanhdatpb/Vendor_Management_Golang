<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cho phép 1 email tồn tại ở NHIỀU dòng user khác nhau (mỗi dòng = 1 vai trò +
     * 1 project riêng). Trước đây email là UNIQUE nên không thể thêm 1 người vào
     * 2 role hoặc 2 project. Bỏ ràng buộc unique, thay bằng index thường để login
     * (where email) vẫn nhanh. Tính duy nhất theo (email, role, project) được đảm
     * bảo ở tầng ứng dụng — AdminUserController::store.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_email_unique');
            $table->index('email', 'users_email_index');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_email_index');
            // Lưu ý: nếu đã có email trùng, việc thêm lại unique sẽ lỗi — cần dọn
            // dữ liệu trùng trước khi rollback.
            $table->unique('email', 'users_email_unique');
        });
    }
};
