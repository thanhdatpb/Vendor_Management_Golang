<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (!Schema::hasColumn('products', 'production_time')) {
                $table->string('production_time')->nullable()->after('product_type_links');
            }
            if (!Schema::hasColumn('products', 'shipping_time')) {
                $table->string('shipping_time')->nullable()->after('production_time');
            }
            if (!Schema::hasColumn('products', 'total_cost')) {
                $table->string('total_cost')->nullable()->after('shipping_time');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['production_time', 'shipping_time', 'total_cost']);
        });
    }
};
