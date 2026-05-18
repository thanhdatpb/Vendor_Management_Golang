<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up()
{
    // Thêm cột mới
    Schema::table('vendors', function (Blueprint $table) {
        $table->enum('vendor_type_new', ['Old', 'New', 'Best Seller'])->nullable();
    });
    
    // Copy dữ liệu từ cột cũ
    DB::statement("UPDATE vendors SET vendor_type_new = 
        CASE 
            WHEN vendor_type = 'Loại 1' THEN 'Old'
            WHEN vendor_type = 'Loại 2' THEN 'New'
            WHEN vendor_type = 'Loại 3' THEN 'Best Seller'
            ELSE vendor_category
        END
    ");
    
    // Xóa cột cũ và đổi tên cột mới
    Schema::table('vendors', function (Blueprint $table) {
        $table->dropColumn(['vendor_type', 'vendor_category']);
        $table->renameColumn('vendor_type_new', 'vendor_type');
    });
}

public function down()
{
    Schema::table('vendors', function (Blueprint $table) {
        $table->string('vendor_type')->nullable();
        $table->string('vendor_category')->nullable();
        $table->dropColumn('vendor_type_new');
    });
}
};
