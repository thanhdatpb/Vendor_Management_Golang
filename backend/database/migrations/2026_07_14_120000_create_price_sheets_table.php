<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_sheets', function (Blueprint $table) {
            // id do frontend sinh (vd "sheet_xxx") — primary key dạng chuỗi
            $table->string('id')->primary();
            $table->string('project')->nullable()->index();
            $table->string('name')->nullable();
            // Toàn bộ nội dung bảng tính giá (settings + productTypes + history) dạng JSON
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_sheets');
    }
};
