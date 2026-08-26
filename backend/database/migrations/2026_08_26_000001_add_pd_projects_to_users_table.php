<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// PD trước đây xem MỌI project (cột `project` không dùng để phân quyền PD nữa).
// Nay cần PD làm nhiều project cùng lúc nhưng KHÔNG phải tất cả — thêm cột
// riêng lưu danh sách project PD được tick ở Quản Lý Nhân Sự. Cột `project`
// (string, 1 giá trị) không tái dùng được vì PD cần NHIỀU giá trị cùng lúc
// trên CÙNG 1 dòng tài khoản (không tách nhiều dòng như Seller).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('pd_projects')->nullable()->after('project');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('pd_projects');
        });
    }
};
