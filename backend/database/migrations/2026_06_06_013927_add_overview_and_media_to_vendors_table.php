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
        Schema::table('vendors', function (Blueprint $table) {
            if (!Schema::hasColumn('vendors', 'overview')) {
                $table->text('overview')->nullable()->after('optional');
            }
            if (!Schema::hasColumn('vendors', 'media_url')) {
                $table->string('media_url')->nullable()->after('overview');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table) {
            if (Schema::hasColumn('vendors', 'overview')) {
                $table->dropColumn('overview');
            }
            if (Schema::hasColumn('vendors', 'media_url')) {
                $table->dropColumn('media_url');
            }
        });
    }
};
