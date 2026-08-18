<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tách lịch sử phiên bản khỏi blob `price_sheets.data` (mục 17).
 *
 * Mỗi lần bấm Lưu, client nhét thêm một snapshot ĐẦY ĐỦ (settings +
 * productTypes) vào `history` và giữ tới 20 bản. Nghĩa là màn hình danh sách —
 * vốn chỉ cần vài con số — đang tải 21 bản sao nội dung của mỗi bảng giá. Payload
 * phình theo số lần bấm Lưu chứ không theo dữ liệu thật.
 *
 * Từ đây snapshot nằm ở bảng riêng, nạp lazy khi mở panel Lịch sử.
 * `history` trong blob cũ KHÔNG bị xoá — backfill chỉ copy sang, giữ đường lùi.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_sheet_versions', function (Blueprint $table) {
            $table->id();
            // Không dùng foreign key: `price_sheets.id` là chuỗi do frontend sinh
            // và có bản ghi cũ mồ côi trên production.
            $table->string('sheet_id');
            $table->unsignedInteger('version');
            $table->timestamp('saved_at')->nullable();
            $table->string('saved_by')->nullable();
            // Snapshot đầy đủ của một lần lưu (settings + productTypes + số tổng hợp).
            $table->longText('data');
            $table->timestamps();

            $table->unique(['sheet_id', 'version']);
            $table->index(['sheet_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_sheet_versions');
    }
};
