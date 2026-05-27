<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Đảm bảo cột vendor_type tồn tại (tránh lỗi import/API sau khi migration drop nhầm).
     */
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            if (! Schema::hasColumn('vendors', 'vendor_type')) {
                $table->string('vendor_type', 64)->nullable()->after('product_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            if (Schema::hasColumn('vendors', 'vendor_type')) {
                $table->dropColumn('vendor_type');
            }
        });
    }
};
