<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * Deploy code TRƯỚC khi migration kịp chạy — tình huống có thật, hai lần.
 *
 * Quy trình deploy của dự án là thủ công: trên VPS `git pull` rồi serve lại
 * `dist/` (CLAUDE.md §7). Không có bước `php artisan migrate` nào trong đó, nên
 * mọi cột mới đều có một khoảng thời gian tồn tại trong CODE mà chưa có trong
 * DB. Sự cố `last_seen_at` 2026-08-18 làm cả trang Quản Lý Nhân Sự trắng danh
 * sách; sự cố `created_by` 2026-08-19 làm Seller không tạo được bảng tính giá.
 *
 * Bài học đắt ở lần thứ hai: chỗ ĐỌC đã được che chắn cẩn thận (index() kiểm
 * Schema::hasColumn, summaryPayload() dùng `??`) nhưng chỗ GHI thì không —
 * và ghi mới là thứ vỡ thành 500, vì thiếu cột lúc INSERT là lỗi SQL chứ
 * không phải giá trị null.
 */
#[Group('price-sheets')]
class PriceSheetCreatedByMissingColumnTest extends TestCase
{
    use RefreshDatabase;

    private function seller(string $name = 'Seller A'): User
    {
        return User::factory()->create(['role' => 'seller', 'project' => 'happy', 'name' => $name, 'is_active' => true]);
    }

    private function payload(string $id): array
    {
        return [
            'id' => $id, 'name' => 'Bang gia moi', 'project' => 'happy',
            'settings' => ['price' => 9.9], 'productTypes' => [], 'history' => [],
        ];
    }

    /** Mô phỏng DB production chưa chạy migration: bỏ hẳn cột đi. */
    private function dropCreatedByColumn(): void
    {
        Schema::table('price_sheets', function ($table) {
            $table->dropColumn('created_by');
        });

        $this->assertFalse(
            Schema::hasColumn('price_sheets', 'created_by'),
            'Test này chỉ có nghĩa khi cột đã thật sự bị bỏ đi'
        );
    }

    public function test_tao_bang_moi_van_luu_duoc_khi_thieu_cot_created_by(): void
    {
        $this->dropCreatedByColumn();

        $this->actingAs($this->seller())
            ->postJson('/api/price-sheets', $this->payload('sheet_1'))
            ->assertOk();

        // Quan trọng nhất: dữ liệu của Seller PHẢI nằm trên server, không phải
        // chỉ trong localStorage của máy họ.
        $this->assertDatabaseHas('price_sheets', ['id' => 'sheet_1', 'name' => 'Bang gia moi']);
    }

    public function test_sua_bang_van_luu_duoc_khi_thieu_cot_created_by(): void
    {
        $this->dropCreatedByColumn();
        $seller = $this->seller();

        $this->actingAs($seller)->postJson('/api/price-sheets', $this->payload('sheet_1'))->assertOk();

        $sheet = $this->payload('sheet_1');
        $sheet['name'] = 'Ten da doi';
        $this->actingAs($seller)->postJson('/api/price-sheets', $sheet)->assertOk();

        $this->assertDatabaseHas('price_sheets', ['id' => 'sheet_1', 'name' => 'Ten da doi']);
    }

    public function test_danh_sach_va_mo_bang_khong_vo_khi_thieu_cot(): void
    {
        $this->dropCreatedByColumn();
        $seller = $this->seller();
        $this->actingAs($seller)->postJson('/api/price-sheets', $this->payload('sheet_1'))->assertOk();

        $row = $this->actingAs($seller)->getJson('/api/price-sheets?summary=1')->assertOk()->json(0);
        $this->assertNull($row['createdBy'], 'Thiếu cột thì để trống, không phải lỗi');

        $full = $this->actingAs($seller)->getJson('/api/price-sheets/sheet_1')->assertOk()->json();
        $this->assertNull($full['createdBy']);
    }

    /** Có cột thì vẫn phải ghi đúng — bản vá không được làm hỏng tính năng. */
    public function test_khi_co_cot_thi_van_ghi_dung_nguoi_tao(): void
    {
        $this->assertTrue(Schema::hasColumn('price_sheets', 'created_by'));

        $this->actingAs($this->seller('Seller A'))
            ->postJson('/api/price-sheets', $this->payload('sheet_1'))
            ->assertOk();

        $this->assertSame('Seller A', DB::table('price_sheets')->where('id', 'sheet_1')->value('created_by'));
    }
}
