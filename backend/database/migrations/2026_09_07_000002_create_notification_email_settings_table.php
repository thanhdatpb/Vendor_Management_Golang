<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ma trận "role × loại thông báo" quyết định có gửi mail hay không — cho phép
 * Admin bật/tắt sau này mà không cần deploy code (màn Quản Lý Nhân Sự sẽ đọc/
 * ghi bảng này, xem App\Http\Controllers\AdminNotificationSettingController).
 *
 * CHỈ chứa các cặp (role, type) THỰC SỰ có thể xảy ra — xem `roles` cho phép
 * của từng type trong config/notification_mail.php. Cặp không tồn tại trong
 * bảng này không bao giờ được kiểm tra tới (đã bị chặn ở tầng role allow-list
 * trước khi đọc bảng), nên không cần liệt kê mọi tổ hợp.
 *
 * Seed ngay trong migration (không dùng Seeder riêng): dự án deploy thủ công
 * bằng `git pull` + `php artisan migrate`, KHÔNG chạy `db:seed` trên
 * production — một Seeder riêng rất dễ không bao giờ chạy, y như 2 sự cố
 * "quên migrate" đã từng xảy ra (last_seen_at, pd_projects).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('notification_email_settings')) {
            Schema::create('notification_email_settings', function (Blueprint $table) {
                $table->id();
                $table->string('role', 32);
                $table->string('type', 32);
                $table->boolean('enabled')->default(true);
                $table->unsignedBigInteger('updated_by')->nullable();
                $table->timestamps();
                $table->unique(['role', 'type']);
            });
        }

        $now = now();
        $rows = [
            ['role' => 'admin',  'type' => 'new_form'],
            ['role' => 'seller', 'type' => 'approved'],
            ['role' => 'seller', 'type' => 'rejected'],
            ['role' => 'vendor', 'type' => 'needs_vendor'],
            ['role' => 'seller', 'type' => 'deadline_updated'],
            ['role' => 'seller', 'type' => 'vendor_assigned'],
            ['role' => 'admin',  'type' => 'library_updated'],
            ['role' => 'vendor', 'type' => 'library_updated'],
            ['role' => 'seller', 'type' => 'library_updated'],
            ['role' => 'pd',     'type' => 'library_updated'],
            ['role' => 'csf',    'type' => 'library_updated'],
            ['role' => 'marvel', 'type' => 'library_updated'],
        ];

        foreach ($rows as $row) {
            $row['enabled']    = true;
            $row['created_at'] = $now;
            $row['updated_at'] = $now;
            DB::table('notification_email_settings')->insertOrIgnore($row);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_email_settings');
    }
};
