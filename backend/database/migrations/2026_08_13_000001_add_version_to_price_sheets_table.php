<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chống ghi đè mất dữ liệu giữa hai người cùng sửa một bảng tính giá (mục 16).
 *
 * Trước migration này, upsert là last-write-wins tuyệt đối: A mở bảng lúc 9h,
 * B sửa và lưu lúc 10h, A lưu lúc 10h05 → toàn bộ thay đổi của B biến mất mà
 * không có cảnh báo nào. Cột `version` cho phép server phát hiện xung đột và
 * trả 409 thay vì âm thầm ghi đè.
 *
 * Bảng cũ mặc định version = 1. Client cũ không gửi `expectedVersion` thì
 * server vẫn xử như trước (xem PriceSheetController::upsert), nên deploy
 * backend trước frontend không làm hỏng ai.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('price_sheets', function (Blueprint $table) {
            $table->unsignedInteger('version')->default(1)->after('name');
            // Danh sách sắp theo updated_at desc ở mọi request — index để không
            // phải filesort khi số bảng lớn dần.
            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::table('price_sheets', function (Blueprint $table) {
            $table->dropIndex(['updated_at']);
            $table->dropColumn('version');
        });
    }
};
