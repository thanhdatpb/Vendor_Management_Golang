<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('products', 'image_url')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('image_url')->nullable();
            });
        }

        if (!Schema::hasColumn('products', 'media_urls')) {
            Schema::table('products', function (Blueprint $table) {
                $table->json('media_urls')->nullable();
            });
        }
    }

    public function down()
    {
        if (Schema::hasColumn('products', 'image_url')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('image_url');
            });
        }

        if (Schema::hasColumn('products', 'media_urls')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('media_urls');
            });
        }
    }
};