<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * users.avatar_url phải chứa được URL ảnh đại diện Google dài bất kỳ.
 *
 * Sự cố thật (2026-08-01): tài khoản quy.hoang@happy-creative.vn đã được cấp
 * quyền nhưng đăng nhập Google lại 500 ở /api/auth/google/callback:
 *   SQLSTATE[22001]: Data too long for column 'avatar_url' at row 1
 * Google trả URL dạng https://lh3.googleusercontent.com/a-/ALV-UjV... dài hơn
 * 1000 ký tự, trong khi cột được tạo ở migration 2026_06_29_000001 chỉ là
 * VARCHAR(500). Ảnh đại diện là thông tin phụ nhưng lại làm hỏng cả việc đăng
 * nhập, vì bước đồng bộ hồ sơ chạy TRƯỚC khi phát token.
 *
 * TEXT (65535 ký tự) thay vì nới VARCHAR thêm vài trăm: độ dài URL avatar do
 * Google quyết định và đã tăng nhiều lần, không nên đoán mức trần mới.
 * SocialAuthController cũng đã được bọc để việc đồng bộ hồ sơ hỏng thì bỏ qua
 * chứ không chặn đăng nhập nữa.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Idempotent: DB nào chưa có cột (chưa chạy migration Google OAuth) thì bỏ qua,
        // tránh migration abort làm kẹt toàn bộ migration phía sau — đúng bài học từ
        // sự cố unique google_id (xem 2026_07_27_000001).
        if (!Schema::hasColumn('users', 'avatar_url')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->text('avatar_url')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('users', 'avatar_url')) {
            return;
        }

        // Thu về VARCHAR(500) sẽ cắt cụt các URL avatar dài đang lưu → link ảnh hỏng.
        // Dọn dữ liệu quá dài trước, rồi mới thu cột lại.
        \DB::table('users')
            ->whereRaw('CHAR_LENGTH(avatar_url) > 500')
            ->update(['avatar_url' => null]);

        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_url', 500)->nullable()->change();
        });
    }
};
