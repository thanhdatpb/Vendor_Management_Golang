<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Chỉ thêm nếu chưa tồn tại
            if (!Schema::hasColumn('products', 'media_urls')) {
                $table->json('media_urls')->nullable()->after('media_url');
            }
            
            if (!Schema::hasColumn('products', 'packaging_links')) {
                $table->text('packaging_links')->nullable();
            }
            
            if (!Schema::hasColumn('products', 'other_packaging')) {
                $table->text('other_packaging')->nullable();
            }
            
            if (!Schema::hasColumn('products', 'good_review')) {
                $table->text('good_review')->nullable();
            }
            
            if (!Schema::hasColumn('products', 'bad_review')) {
                $table->text('bad_review')->nullable();
            }
        });
        
        // Migration cho users table
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'project')) {
                $table->string('project')->nullable()->after('email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['media_urls', 'packaging_links', 'other_packaging', 'good_review', 'bad_review']);
        });
        
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('project');
        });
    }
};