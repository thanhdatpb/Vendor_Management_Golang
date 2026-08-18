<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cột tổng hợp cho màn hình danh sách bảng tính giá.
 *
 * Trước đây `GET /price-sheets` trả nguyên cột `data` (settings + productTypes +
 * tới 20 bản history) chỉ để frontend tính ra vài con số. Có các cột này thì
 * danh sách đọc thẳng, không chạm vào blob.
 *
 * Không đụng tới cột `data` — dữ liệu cũ giữ nguyên, backfill chạy riêng bằng
 * `php artisan pricesheets:backfill-versions`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('price_sheets', function (Blueprint $table) {
            if (!Schema::hasColumn('price_sheets', 'vendor_ref')) {
                $table->string('vendor_ref')->nullable()->after('name');
            }
            if (!Schema::hasColumn('price_sheets', 'source_file')) {
                $table->string('source_file')->nullable()->after('vendor_ref');
            }
            if (!Schema::hasColumn('price_sheets', 'product_type_names')) {
                // JSON mảng tên Product Type — danh sách hiện chip + cho tìm kiếm.
                $table->text('product_type_names')->nullable()->after('source_file');
            }
            if (!Schema::hasColumn('price_sheets', 'size_count')) {
                $table->unsignedInteger('size_count')->default(0)->after('product_type_names');
            }
            if (!Schema::hasColumn('price_sheets', 'min_price')) {
                $table->decimal('min_price', 14, 4)->nullable()->after('size_count');
            }
            if (!Schema::hasColumn('price_sheets', 'max_price')) {
                $table->decimal('max_price', 14, 4)->nullable()->after('min_price');
            }
            if (!Schema::hasColumn('price_sheets', 'avg_margin')) {
                $table->decimal('avg_margin', 12, 4)->nullable()->after('max_price');
            }
            if (!Schema::hasColumn('price_sheets', 'updated_by')) {
                $table->string('updated_by')->nullable()->after('avg_margin');
            }
        });
        // Index `updated_at` đã được thêm ở migration `add_version_to_price_sheets_table`
        // (mục 16) — không thêm lại ở đây để tránh trùng tên index.
    }

    public function down(): void
    {
        Schema::table('price_sheets', function (Blueprint $table) {
            $table->dropColumn([
                'vendor_ref',
                'source_file',
                'product_type_names',
                'size_count',
                'min_price',
                'max_price',
                'avg_margin',
                'updated_by',
            ]);
        });
    }
};
