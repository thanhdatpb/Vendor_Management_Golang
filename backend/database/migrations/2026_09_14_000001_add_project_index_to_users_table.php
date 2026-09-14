<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// products.stats() (Overview admin) và whereHas('creator', ...project) trong
// ProductController::index() đều lọc theo users.project — cột này chưa có index,
// full scan bảng users mỗi lần gọi khi dữ liệu lớn lên.
return new class extends Migration
{
    // Có guard vì index trên production đã từng được thêm/gỡ TAY qua phpMyAdmin.
    // Gọi thẳng index() khi index đã tồn tại → "Duplicate key name" → migrate abort
    // và MỌI migration phía sau không bao giờ chạy (xem 2026_07_27_000001).
    public function up(): void
    {
        $indexes = collect(Schema::getIndexes('users'))->pluck('name');

        Schema::table('users', function (Blueprint $table) use ($indexes) {
            if (!$indexes->contains('users_project_index')) {
                $table->index('project', 'users_project_index');
            }
        });
    }

    public function down(): void
    {
        $indexes = collect(Schema::getIndexes('users'))->pluck('name');

        Schema::table('users', function (Blueprint $table) use ($indexes) {
            if ($indexes->contains('users_project_index')) {
                $table->dropIndex('users_project_index');
            }
        });
    }
};
