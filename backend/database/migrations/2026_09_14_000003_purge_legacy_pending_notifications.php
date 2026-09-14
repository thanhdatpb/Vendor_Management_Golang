<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Dọn MỘT LẦN thông báo type='pending' — loại cũ, trùng nội dung với 'new_form'
 * cho cùng một form request.
 *
 * Trước đây NotificationController::index() xoá chúng ngay trong request đọc, mà
 * mỗi dashboard gọi endpoint đó 15 giây/lần ⇒ mỗi phiên mở tab sinh 4 câu DELETE
 * mỗi phút chỉ để dọn dữ liệu chết. Không còn chỗ nào tạo type='pending' nữa
 * (method sinh ra nó chưa từng có route và đã bị gỡ), nên dọn một lần là xong.
 *
 * Xoá theo lô để không giữ transaction dài trên shared hosting.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('notifications')) {
            return;
        }

        do {
            $deleted = DB::table('notifications')
                ->where('type', 'pending')
                ->limit(1000)
                ->delete();
        } while ($deleted > 0);
    }

    public function down(): void
    {
        // Dữ liệu chết đã xoá — không khôi phục.
    }
};
