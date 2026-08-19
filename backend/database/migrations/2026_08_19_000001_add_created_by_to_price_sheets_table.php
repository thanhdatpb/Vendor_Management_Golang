<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Người tạo" cho màn Admin — Bảng Tính Giá. Cố ý là cột RIÊNG với
 * `updated_by`, không dùng chung:
 *   updated_by — ghi lại MỖI lần lưu, luôn là người sửa gần nhất.
 *   created_by — chỉ ghi ĐÚNG MỘT LẦN lúc tạo (xem PriceSheetController::upsert,
 *                nhánh INSERT), không đổi dù sau này ai khác sửa bảng.
 *
 * Bảng đã tạo TRƯỚC migration này không truy ngược được ai tạo — cột để NULL
 * vĩnh viễn cho các dòng đó, không có cách nào suy ra từ dữ liệu cũ (blob
 * không lưu thông tin actor, chỉ lưu nội dung bảng).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('price_sheets', function (Blueprint $table) {
            if (!Schema::hasColumn('price_sheets', 'created_by')) {
                $table->string('created_by')->nullable()->after('updated_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('price_sheets', function (Blueprint $table) {
            $table->dropColumn('created_by');
        });
    }
};
