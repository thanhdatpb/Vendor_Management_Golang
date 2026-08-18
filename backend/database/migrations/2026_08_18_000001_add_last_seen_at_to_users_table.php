<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mốc truy cập gần nhất của từng tài khoản — cột "Lần truy cập cuối" ở màn hình
 * Quản Lý Nhân Sự.
 *
 * Trước đây chỉ có mốc "đang online" lưu trong localStorage của từng máy, nên
 * Admin không có cách nào biết một tài khoản còn được dùng hay đã bỏ không.
 *
 * `User::$casts` từ trước đã khai `last_login_at` nhưng KHÔNG hề có cột đó
 * trong DB và cũng không chỗ nào ghi — code thừa. Cột mới đặt tên
 * `last_seen_at` cho đúng nghĩa: mốc thao tác gần nhất, không phải mốc đăng nhập.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'last_seen_at')) {
                $table->timestamp('last_seen_at')->nullable()->after('is_active');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_seen_at');
        });
    }
};
