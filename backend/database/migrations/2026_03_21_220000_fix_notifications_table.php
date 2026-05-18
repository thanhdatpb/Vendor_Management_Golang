<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Nếu bảng notifications chưa có cột title/body đúng chuẩn thì tạo lại
        if (!Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('type')->default('info');   // approved, rejected, feedback, vendor_assigned
                $table->string('title');
                $table->text('body')->nullable();
                $table->boolean('is_read')->default(false);
                $table->timestamps();
                $table->index(['user_id', 'is_read']);
            });
        } else {
            Schema::table('notifications', function (Blueprint $table) {
                if (!Schema::hasColumn('notifications', 'title'))
                    $table->string('title')->nullable()->after('type');
                if (!Schema::hasColumn('notifications', 'body'))
                    $table->text('body')->nullable()->after('title');
                if (!Schema::hasColumn('notifications', 'is_read'))
                    $table->boolean('is_read')->default(false)->after('body');
            });
        }
    }

    public function down(): void {}
};