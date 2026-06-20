<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('vendor_library')) {
            Schema::create('vendor_library', function (Blueprint $table) {
                $table->id();
                $table->longText('data');
                $table->timestamps();
            });

            // Migrate dữ liệu từ file cũ (nếu tồn tại) sang DB
            $filePath = storage_path('app/vendor_library.json');
            if (file_exists($filePath)) {
                $json = file_get_contents($filePath);
                if ($json && json_decode($json) !== null) {
                    DB::table('vendor_library')->insert([
                        'data'       => $json,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_library');
    }
};
