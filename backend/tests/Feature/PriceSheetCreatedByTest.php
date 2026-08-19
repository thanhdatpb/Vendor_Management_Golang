<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * "Người tạo" ở màn Admin — Bảng Tính Giá.
 *
 * Cột `created_by` khác `updated_by`: chỉ ghi ĐÚNG MỘT LẦN lúc tạo, không đổi
 * dù sau này ai khác sửa bảng. Nếu dùng chung với updated_by thì Seller B sửa
 * bảng Seller A tạo sẽ hiện SAI là "người tạo" — đúng lỗi Admin dùng cột này
 * để truy vết sẽ bị lừa.
 */
#[Group('price-sheets')]
class PriceSheetCreatedByTest extends TestCase
{
    use RefreshDatabase;

    private function seller(string $name = 'Seller A', string $project = 'happy'): User
    {
        return User::factory()->create(['role' => 'seller', 'project' => $project, 'name' => $name, 'is_active' => true]);
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'project' => null, 'is_active' => true]);
    }

    private function payload(string $id, string $name = 'Bang giá'): array
    {
        return [
            'id' => $id, 'name' => $name, 'project' => 'happy',
            'settings' => ['price' => 9.9], 'productTypes' => [], 'history' => [],
        ];
    }

    public function test_tao_moi_ghi_dung_nguoi_tao(): void
    {
        $sellerA = $this->seller('Seller A');

        $this->actingAs($sellerA)->postJson('/api/price-sheets', $this->payload('sheet_1'))->assertOk();

        $this->assertDatabaseHas('price_sheets', ['id' => 'sheet_1', 'created_by' => 'Seller A']);
    }

    /** Trọng tâm của tính năng: sửa bởi người KHÁC không đổi người tạo. */
    public function test_nguoi_khac_sua_khong_doi_nguoi_tao(): void
    {
        $sellerA = $this->seller('Seller A');
        $sellerB = $this->seller('Seller B');

        $this->actingAs($sellerA)->postJson('/api/price-sheets', $this->payload('sheet_1'))->assertOk();
        $version = DB::table('price_sheets')->where('id', 'sheet_1')->value('version');

        $sheet = $this->payload('sheet_1', 'Ten da doi');
        $sheet['version'] = $version;
        $sheet['expectedVersion'] = $version;
        $this->actingAs($sellerB)->postJson('/api/price-sheets', $sheet)->assertOk();

        $row = DB::table('price_sheets')->where('id', 'sheet_1')->first();
        $this->assertSame('Seller A', $row->created_by, 'created_by KHÔNG được đổi khi người khác sửa');
        $this->assertSame('Seller B', $row->updated_by, 'updated_by phải là người sửa gần nhất');
    }

    public function test_danh_sach_tra_ca_hai_cot(): void
    {
        $sellerA = $this->seller('Seller A');
        $sellerB = $this->seller('Seller B');
        $this->actingAs($sellerA)->postJson('/api/price-sheets', $this->payload('sheet_1'))->assertOk();
        $version = DB::table('price_sheets')->where('id', 'sheet_1')->value('version');
        $sheet = $this->payload('sheet_1');
        $sheet['expectedVersion'] = $version;
        $this->actingAs($sellerB)->postJson('/api/price-sheets', $sheet)->assertOk();

        $row = $this->actingAs($this->admin())->getJson('/api/price-sheets?summary=1')->assertOk()->json(0);

        $this->assertSame('Seller A', $row['createdBy']);
        $this->assertSame('Seller B', $row['updatedBy']);
    }

    /** show() phải bơm createdBy/updatedBy từ DB row — blob không tự chứa 2 trường này. */
    public function test_mo_bang_day_du_cung_co_nguoi_tao(): void
    {
        $sellerA = $this->seller('Seller A');
        $this->actingAs($sellerA)->postJson('/api/price-sheets', $this->payload('sheet_1'))->assertOk();

        $full = $this->actingAs($this->admin())->getJson('/api/price-sheets/sheet_1')->assertOk()->json();

        $this->assertSame('Seller A', $full['createdBy']);
        $this->assertSame('Seller A', $full['updatedBy']);
    }

    /** Bảng tạo trước migration này: không truy ngược được, trả null chứ không phải lỗi. */
    public function test_bang_cu_truoc_migration_tra_null_khong_loi(): void
    {
        DB::table('price_sheets')->insert([
            'id' => 'sheet_old', 'project' => 'happy', 'name' => 'Bang cu',
            'data' => json_encode(['id' => 'sheet_old', 'project' => 'happy', 'settings' => [], 'productTypes' => []]),
            'created_at' => now(), 'updated_at' => now(),
            // Cố tình KHÔNG set created_by — mô phỏng dòng có từ trước migration.
        ]);

        $row = $this->actingAs($this->admin())->getJson('/api/price-sheets?summary=1')->assertOk()->json(0);

        $this->assertArrayHasKey('createdBy', $row);
        $this->assertNull($row['createdBy']);
    }
}
