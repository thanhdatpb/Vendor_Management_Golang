<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PR-D1 — Màn hình danh sách bảng giá KHÔNG được tải cả lịch sử.
 *
 * Lỗi gốc: mỗi lần bấm Lưu, workspace nhét thêm một snapshot ĐẦY ĐỦ (settings +
 * productTypes) vào `history`, giữ tới 20 bản. `GET /price-sheets` trả nguyên
 * cột `data` → danh sách tải 21 bản sao nội dung của mỗi bảng, nhân với số bảng
 * của project. Payload phình theo số lần bấm Lưu, không theo dữ liệu thật.
 *
 * ĐÃ FIX (mục 17): danh sách đọc các cột tổng hợp, nội dung đầy đủ nằm ở
 * `GET /price-sheets/{id}`, lịch sử ở `GET /price-sheets/{id}/versions`.
 * Test này giờ là cổng chặn merge — đỏ nghĩa là ai đó đã trả lại blob vào danh sách.
 */
#[Group('milestone-d')]
class PriceSheetListPayloadTest extends TestCase
{
    use RefreshDatabase;

    private function seller(): User
    {
        return User::factory()->create(['role' => 'seller', 'project' => 'happy', 'is_active' => true]);
    }

    /** Một Product Type ~20 size, đủ nặng để thấy khác biệt giữa summary và full. */
    private function fatSheet(string $id, int $historyCount): array
    {
        $sizes = [];
        foreach (range(1, 20) as $i) {
            $sizes[] = ['id' => "sz{$i}", 'label' => "SIZE-{$i}", 'sizeAdd' => $i, 'itemCost' => 8.2, 'customize' => ['ci1' => 3]];
        }
        $productTypes = [[
            'id' => 'pt1', 'name' => 'Football Jersey', 'phoi' => 0, 'shown' => true,
            'customizeInfos' => [['id' => 'ci1', 'name' => 'Add Custom Face']], 'sizes' => $sizes,
        ]];
        $settings = ['price' => 9.9, 'quantity' => 1, 'amzFeePct' => 17, 'shipPerItem' => 2];

        $history = [];
        for ($v = $historyCount; $v >= 1; $v--) {
            $history[] = ['version' => $v, 'savedAt' => now()->toIso8601String(), 'savedBy' => 'Seller',
                'settings' => $settings, 'productTypes' => $productTypes];
        }

        return ['id' => $id, 'name' => "Bang gia {$id}", 'project' => 'happy',
            'settings' => $settings, 'productTypes' => $productTypes, 'history' => $history];
    }

    private function seedSheet(string $id, int $historyCount): void
    {
        DB::table('price_sheets')->insert([
            'id' => $id, 'project' => 'happy', 'name' => "Bang gia {$id}",
            'data' => json_encode($this->fatSheet($id, $historyCount)),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_danh_sach_khong_tra_lich_su_va_khong_tra_noi_dung_day_du(): void
    {
        $this->seedSheet('sheet_1', 20);

        $body = $this->actingAs($this->seller())->getJson('/api/price-sheets?summary=1')->assertOk()->getContent();

        $this->assertStringNotContainsString('"history"', $body);
        $this->assertStringNotContainsString('"productTypes"', $body);
    }

    public function test_danh_sach_van_du_thong_tin_de_ve_man_hinh(): void
    {
        // Màn hình danh sách chỉ cần: tên, vendor, số size, khoảng giá, avg margin,
        // người cập nhật cuối. Thiếu thì UI phải tự cộng dồn → quay lại tải full.
        $this->seedSheet('sheet_1', 20);

        $row = $this->actingAs($this->seller())->getJson('/api/price-sheets?summary=1')->assertOk()->json(0);

        foreach (['id', 'name', 'project', 'sizeCount', 'minPrice', 'maxPrice', 'avgMargin', 'updatedAt'] as $key) {
            $this->assertArrayHasKey($key, $row);
        }
        $this->assertSame(20, $row['sizeCount']);
    }

    public function test_mo_mot_bang_moi_tra_noi_dung_day_du(): void
    {
        $this->seedSheet('sheet_1', 20);

        $full = $this->actingAs($this->seller())->getJson('/api/price-sheets/sheet_1')->assertOk()->json();

        $this->assertArrayHasKey('productTypes', $full);
        $this->assertCount(20, $full['productTypes'][0]['sizes']);
    }

    public function test_payload_danh_sach_khong_phinh_theo_so_lan_bam_luu(): void
    {
        $this->seedSheet('sheet_it_lich_su', 1);
        $small = strlen($this->actingAs($this->seller())->getJson('/api/price-sheets?summary=1')->getContent());

        DB::table('price_sheets')->where('id', 'sheet_it_lich_su')
            ->update(['data' => json_encode($this->fatSheet('sheet_it_lich_su', 20))]);
        $big = strlen($this->actingAs($this->seller())->getJson('/api/price-sheets?summary=1')->getContent());

        $this->assertLessThan(
            $small * 1.1,
            $big,
            'Payload danh sách phình theo số lần lưu — nghĩa là vẫn đang trả lịch sử.'
        );
    }

    public function test_lich_su_nap_rieng_khi_mo_panel(): void
    {
        $this->seedSheet('sheet_1', 20);

        $versions = $this->actingAs($this->seller())
            ->getJson('/api/price-sheets/sheet_1/versions')
            ->assertOk()
            ->json();

        $this->assertCount(20, $versions);
    }

    /**
     * Client CŨ (bundle còn trong cache trình duyệt sau khi deploy backend)
     * không gửi cờ `summary` và vẫn phải nhận nội dung đầy đủ.
     *
     * Nếu nó nhận bản rút gọn: workspace mở ra bảng TRỐNG, và chỉ cần người
     * dùng bấm Lưu là bảng giá thật bị ghi đè bằng bảng rỗng. Đây là test chặn
     * đúng ca mất dữ liệu đó — chỉ được xoá khi đã chắc không còn client cũ.
     */
    public function test_client_cu_khong_gui_co_van_nhan_noi_dung_day_du(): void
    {
        $this->seedSheet('sheet_1', 20);

        $row = $this->actingAs($this->seller())->getJson('/api/price-sheets')->assertOk()->json(0);

        $this->assertArrayHasKey('productTypes', $row);
        $this->assertCount(20, $row['productTypes'][0]['sizes']);
        $this->assertArrayHasKey('settings', $row);
    }

    public function test_seller_khong_mo_duoc_bang_cua_project_khac(): void
    {
        DB::table('price_sheets')->insert([
            'id' => 'sheet_creative', 'project' => 'creative', 'name' => 'Cua project khac',
            'data' => json_encode(['id' => 'sheet_creative', 'project' => 'creative']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->actingAs($this->seller())->getJson('/api/price-sheets/sheet_creative')->assertStatus(403);
    }
}
