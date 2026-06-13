<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            if (!Schema::hasColumn('vendors', 'avg_time_vendor')) {
                $table->string('avg_time_vendor', 500)->nullable()->after('overview');
            }
            if (!Schema::hasColumn('vendors', 'avg_time_actual')) {
                $table->string('avg_time_actual', 500)->nullable()->after('avg_time_vendor');
            }
            if (!Schema::hasColumn('vendors', 'notes')) {
                $table->text('notes')->nullable()->after('avg_time_actual');
            }
            if (!Schema::hasColumn('vendors', 'pricing2')) {
                $table->float('pricing2')->nullable()->after('pricing1');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            $table->dropColumn(['avg_time_vendor', 'avg_time_actual', 'notes']);
        });
    }
};
