<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // 'products' table in this project doesn't have 'image' column
            $table->string('media_path')->nullable()->after('vendor_id');
            $table->string('media_kind')->nullable()->after('media_path'); // image|video
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['media_path', 'media_kind']);
        });
    }
};

