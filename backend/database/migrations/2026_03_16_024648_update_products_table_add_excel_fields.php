<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {

            if (!Schema::hasColumn('products', 'deadline_date')) {
                $table->date('deadline_date')->nullable()->after('created_by');
            }

            if (!Schema::hasColumn('products', 'product_type_link')) {
                $table->string('product_type_link', 500)->nullable()->after('product_type');
            }

        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {

            if (Schema::hasColumn('products', 'deadline_date')) {
                $table->dropColumn('deadline_date');
            }

            if (Schema::hasColumn('products', 'product_type_link')) {
                $table->dropColumn('product_type_link');
            }

        });
    }
};