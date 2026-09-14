<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Index cho các truy vấn chạy thường xuyên nhất mà hiện đang full scan.
 *
 * Mỗi index đều bám vào một câu query có thật trong code:
 *  - products (deleted_at, created_at) : ProductController::index() — latest() +
 *    SoftDeletes ⇒ "WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT n".
 *    Không có index ⇒ filesort toàn bảng cho MỖI lần mở danh sách.
 *  - notifications (user_id, created_at) : NotificationController::index() —
 *    latest()->take(50). Index (user_id, is_read) sẵn có KHÔNG phục vụ ORDER BY.
 *  - notifications (user_id, type) : cùng chỗ, nhánh dọn type='pending'.
 *  - users.role : NotificationService::sendToRole() (whereIn role) + middleware
 *    admin + màn Quản Lý Nhân Sự.
 *  - vendors.product_type / vendors.category : vendorComparison() tra theo 2 cột này.
 *  - news.created_at : NewsController::index() orderBy created_at desc.
 *
 * Gỡ index thừa: price_sheet_versions có unique(sheet_id, version) VÀ index
 * (sheet_id, version) trùng hệt — unique đã phục vụ mọi truy vấn của index kia,
 * giữ lại chỉ tốn thêm một lần ghi B-tree mỗi lần lưu bảng giá.
 *
 * Toàn bộ đều có guard theo tên index: production từng bị sửa tay qua phpMyAdmin,
 * gọi thẳng sẽ nổ "Duplicate key name" và chặn mọi migration phía sau.
 */
return new class extends Migration
{
    /** @var array<string, array<string, string[]>> bảng => [tên index => cột] */
    private const INDEXES = [
        'products' => [
            'products_deleted_at_created_at_index' => ['deleted_at', 'created_at'],
        ],
        'notifications' => [
            'notifications_user_id_created_at_index' => ['user_id', 'created_at'],
            'notifications_user_id_type_index'       => ['user_id', 'type'],
        ],
        'users' => [
            'users_role_index' => ['role'],
        ],
        'vendors' => [
            'vendors_product_type_index' => ['product_type'],
            'vendors_category_index'     => ['category'],
        ],
        'news' => [
            'news_created_at_index' => ['created_at'],
        ],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $tableName => $indexes) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            $existing = collect(Schema::getIndexes($tableName))->pluck('name');

            Schema::table($tableName, function (Blueprint $table) use ($tableName, $indexes, $existing) {
                foreach ($indexes as $indexName => $columns) {
                    $missingColumn = collect($columns)
                        ->first(fn ($column) => !Schema::hasColumn($tableName, $column));

                    if ($missingColumn || $existing->contains($indexName)) {
                        continue;
                    }

                    $table->index($columns, $indexName);
                }
            });
        }

        if (Schema::hasTable('price_sheet_versions')) {
            $existing = collect(Schema::getIndexes('price_sheet_versions'))->pluck('name');

            Schema::table('price_sheet_versions', function (Blueprint $table) use ($existing) {
                if ($existing->contains('price_sheet_versions_sheet_id_version_index')
                    && $existing->contains('price_sheet_versions_sheet_id_version_unique')) {
                    $table->dropIndex('price_sheet_versions_sheet_id_version_index');
                }
            });
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $tableName => $indexes) {
            if (!Schema::hasTable($tableName)) {
                continue;
            }

            $existing = collect(Schema::getIndexes($tableName))->pluck('name');

            Schema::table($tableName, function (Blueprint $table) use ($indexes, $existing) {
                foreach (array_keys($indexes) as $indexName) {
                    if ($existing->contains($indexName)) {
                        $table->dropIndex($indexName);
                    }
                }
            });
        }

        if (Schema::hasTable('price_sheet_versions')) {
            $existing = collect(Schema::getIndexes('price_sheet_versions'))->pluck('name');

            Schema::table('price_sheet_versions', function (Blueprint $table) use ($existing) {
                if (!$existing->contains('price_sheet_versions_sheet_id_version_index')) {
                    $table->index(['sheet_id', 'version'], 'price_sheet_versions_sheet_id_version_index');
                }
            });
        }
    }
};
