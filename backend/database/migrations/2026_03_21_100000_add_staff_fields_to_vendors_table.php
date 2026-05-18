<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {

            if (!Schema::hasColumn('vendors', 'product_type')) {
                $table->string('product_type')->nullable()->after('id');
            }
            if (!Schema::hasColumn('vendors', 'vendor_category')) {
                $table->string('vendor_category')->nullable()->after('product_type');
            }
            if (!Schema::hasColumn('vendors', 'vendor_type')) {
                $table->string('vendor_type')->nullable()->after('vendor_category');
            }
            if (!Schema::hasColumn('vendors', 'size')) {
                $table->string('size')->nullable()->after('vendor_type');
            }
            if (!Schema::hasColumn('vendors', 'optional')) {
                $table->string('optional')->nullable()->after('size');
            }
            if (!Schema::hasColumn('vendors', 'pricing1')) {
                $table->decimal('pricing1', 10, 2)->nullable()->after('optional');
            }
            if (!Schema::hasColumn('vendors', 'pricing2')) {
                $table->decimal('pricing2', 10, 2)->nullable()->after('pricing1');
            }
            if (!Schema::hasColumn('vendors', 'eco_price')) {
                $table->decimal('eco_price', 10, 2)->nullable()->after('pricing2');
            }
            if (!Schema::hasColumn('vendors', 'eco_total')) {
                $table->decimal('eco_total', 10, 2)->nullable()->after('eco_price');
            }
            if (!Schema::hasColumn('vendors', 'fast_price')) {
                $table->decimal('fast_price', 10, 2)->nullable()->after('eco_total');
            }
            if (!Schema::hasColumn('vendors', 'fast_total')) {
                $table->decimal('fast_total', 10, 2)->nullable()->after('fast_price');
            }
            if (!Schema::hasColumn('vendors', 'express_price')) {
                $table->decimal('express_price', 10, 2)->nullable()->after('fast_total');
            }
            if (!Schema::hasColumn('vendors', 'express_total')) {
                $table->decimal('express_total', 10, 2)->nullable()->after('express_price');
            }
            if (!Schema::hasColumn('vendors', 'overnight_price')) {
                $table->decimal('overnight_price', 10, 2)->nullable()->after('express_total');
            }
            if (!Schema::hasColumn('vendors', 'overnight_total')) {
                $table->decimal('overnight_total', 10, 2)->nullable()->after('overnight_price');
            }
            if (!Schema::hasColumn('vendors', 'deleted_at')) {
                $table->softDeletes();
            }
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $cols = [
                'product_type', 'vendor_category', 'vendor_type',
                'size', 'optional', 'pricing1', 'pricing2',
                'eco_price', 'eco_total', 'fast_price', 'fast_total',
                'express_price', 'express_total',
                'overnight_price', 'overnight_total', 'deleted_at',
            ];
            $toDrop = array_filter($cols, function ($col) {
                return Schema::hasColumn('vendors', $col);
            });
            if (!empty($toDrop)) {
                $table->dropColumn(array_values($toDrop));
            }
        });
    }
};