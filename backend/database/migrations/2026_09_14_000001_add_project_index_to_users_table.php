<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// products.stats() (Overview admin) và whereHas('creator', ...project) trong
// ProductController::index() đều lọc theo users.project — cột này chưa có index,
// full scan bảng users mỗi lần gọi khi dữ liệu lớn lên.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->index('project');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['project']);
        });
    }
};
