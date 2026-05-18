<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Cho phép NULL toàn bộ cột cũ của bảng vendors.
     * Tránh lỗi "Field doesn't have a default value" khi
     * Staff Dashboard B chỉ gửi các cột mới.
     */
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {

            if (Schema::hasColumn('vendors', 'name'))
                $table->string('name')->nullable()->default('')->change();

            if (Schema::hasColumn('vendors', 'phone'))
                $table->string('phone')->nullable()->default(null)->change();

            if (Schema::hasColumn('vendors', 'email'))
                $table->string('email')->nullable()->default(null)->change();

            if (Schema::hasColumn('vendors', 'category'))
                $table->string('category')->nullable()->default(null)->change();

            if (Schema::hasColumn('vendors', 'production_price'))
                $table->decimal('production_price', 10, 2)->nullable()->default(null)->change();

            if (Schema::hasColumn('vendors', 'shipping_price'))
                $table->decimal('shipping_price', 10, 2)->nullable()->default(null)->change();

            if (Schema::hasColumn('vendors', 'product_price'))
                $table->decimal('product_price', 10, 2)->nullable()->default(null)->change();

            if (Schema::hasColumn('vendors', 'total_cost'))
                $table->decimal('total_cost', 10, 2)->nullable()->default(null)->change();

            if (Schema::hasColumn('vendors', 'media_path'))
                $table->string('media_path')->nullable()->default(null)->change();

            if (Schema::hasColumn('vendors', 'media_kind'))
                $table->string('media_kind')->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        // Không rollback — tránh mất dữ liệu
    }
};