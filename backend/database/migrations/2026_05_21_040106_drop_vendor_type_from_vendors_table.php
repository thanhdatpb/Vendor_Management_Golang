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
        // Giữ cột vendor_type để tương thích luồng import Vendor.
        // Migration này từng gây lỗi import khi API vẫn validate vendor_type.
        // Intentionally no-op.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // no-op
    }
};
