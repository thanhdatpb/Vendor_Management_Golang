<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {

            $table->decimal('production_price',10,2)->nullable();
            $table->decimal('shipping_price',10,2)->nullable();
            $table->decimal('product_price',10,2)->nullable();
            $table->decimal('total_cost',10,2)->nullable();

        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {

            $table->dropColumn([
                'production_price',
                'shipping_price',
                'product_price',
                'total_cost'
            ]);

        });
    }
};