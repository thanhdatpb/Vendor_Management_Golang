<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('product_type')->nullable()->comment('Loại sản phẩm');
            $table->longText('media_links')->nullable()->comment('Link hình ảnh và video');
            $table->string('production_time')->nullable()->comment('Thời gian sản xuất mong muốn');
            $table->string('shipping_time')->nullable()->comment('Thời gian ship mong muốn');
            $table->decimal('total_cost', 15, 2)->nullable()->comment('Total Cost');
            $table->text('material')->nullable()->comment('Chất liệu');
            $table->text('print_area')->nullable()->comment('Vùng in');
            $table->text('other_specs')->nullable()->comment('Thiết kế khác');
            $table->text('good_review')->nullable()->comment('Good Review');
            $table->text('bad_review')->nullable()->comment('Bad Review');
            $table->longText('packaging_links')->nullable()->comment('Packaging & đóng gói');
            $table->text('other_packaging')->nullable()->comment('Other Packaging');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'product_type', 'media_links', 'production_time', 'shipping_time',
                'total_cost', 'material', 'print_area', 'other_specs',
                'good_review', 'bad_review', 'packaging_links', 'other_packaging'
            ]);
        });
    }
};
