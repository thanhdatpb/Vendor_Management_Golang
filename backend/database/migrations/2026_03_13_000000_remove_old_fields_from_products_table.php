<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // drop the legacy columns that are no longer used by the new UI/validation
            $table->dropColumn([
                'name',
                'sku',
                'category',
                'price',
                'cost_price',
                'stock',
                'total_sold',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('name')->nullable();
            $table->string('sku')->nullable();
            $table->string('category')->nullable();
            $table->decimal('price', 15, 2)->nullable();
            $table->decimal('cost_price', 15, 2)->nullable();
            $table->integer('stock')->nullable();
            $table->integer('total_sold')->nullable();
        });
    }
};