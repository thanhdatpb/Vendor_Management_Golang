<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Đánh dấu thời điểm một thông báo (news) thực sự được phát tới Admin & Seller.
     *
     * Trước đây bảng `news` chỉ là danh sách CRUD của Vendor, còn việc "gửi" chỉ ghi
     * vào localStorage của chính máy Vendor nên không ai bên nhận thấy, và cũng không
     * có chỗ nào ghi lại là đã gửi hay chưa. `sent_at` là mốc đó:
     *   - NULL  → bản nháp, Vendor còn sửa/xoá/gửi được.
     *   - có giá trị → đã phát thành notification cho Admin & Seller, khoá sửa/xoá/gửi lại.
     *
     * Các dòng news cũ để NULL — chúng chưa từng được gửi tới server lần nào, nên coi
     * là nháp và Vendor bấm Gửi lại một lần cho đúng.
     */
    public function up(): void
    {
        // Idempotent: migration có thể đã được áp bằng tay trên server (xem CLAUDE.md
        // mục 7 — một migration lỗi sẽ chặn toàn bộ migration phía sau).
        if (Schema::hasTable('news') && !Schema::hasColumn('news', 'sent_at')) {
            Schema::table('news', function (Blueprint $table) {
                $table->timestamp('sent_at')->nullable()->after('target');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('news') && Schema::hasColumn('news', 'sent_at')) {
            Schema::table('news', function (Blueprint $table) {
                $table->dropColumn('sent_at');
            });
        }
    }
};
