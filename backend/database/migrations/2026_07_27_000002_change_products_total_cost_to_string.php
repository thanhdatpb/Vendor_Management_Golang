<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * products.total_cost phải chứa được KHOẢNG GIÁ ("100-150"), không chỉ một con số.
 * Nhãn của trường trên form Seller đã hướng dẫn "Ví dụ: 100-150" từ lâu, nhưng cột
 * vẫn là DECIMAL nên nhập khoảng là hỏng.
 *
 * Vì sao cột chưa phải string: migration 2026_06_16_065324 đã định tạo nó dạng
 * string, nhưng bọc trong `if (!Schema::hasColumn('products', 'total_cost'))` — mà
 * cột đã tồn tại sẵn dạng DECIMAL(15,2) từ 2026_03_12_100736, nên nhánh đó KHÔNG
 * BAO GIỜ chạy. Nới validation ở tầng PHP thôi là chưa đủ: MySQL vẫn từ chối
 * (strict mode) hoặc cắt cụt "100-150" thành 100.00.
 *
 * Dữ liệu cũ dạng số được MySQL chuyển sang text nguyên vẹn ("12.00"), không mất mát.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('products', 'total_cost')) {
            return;
        }

        Schema::table('products', function (Blueprint $table) {
            $table->string('total_cost', 255)->nullable()->comment('Total Cost — số hoặc khoảng giá, vd "100-150"')->change();
        });
    }

    public function down(): void
    {
        // Cố tình KHÔNG revert về decimal: mọi bản ghi đang lưu khoảng giá ("100-150")
        // sẽ bị lỗi hoặc bị cắt cụt thành 100.00 — mất dữ liệu không khôi phục được.
        // Nếu thật sự cần lùi, phải xử lý các bản ghi dạng khoảng bằng tay trước.
    }
};
