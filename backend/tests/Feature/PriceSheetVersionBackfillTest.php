<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PR-D1 (mục 17) — Tách lịch sử ra bảng riêng mà KHÔNG mất dữ liệu.
 *
 * Đây là phần rủi ro nhất của Milestone D: nếu backfill sai thì mất lịch sử
 * tính giá thật của Seller. Nguyên tắc: chỉ COPY, `history` trong blob cũ giữ
 * nguyên làm đường lùi cho lần deploy đầu.
 */
#[Group('milestone-d')]
class PriceSheetVersionBackfillTest extends TestCase
{
    use RefreshDatabase;

    private function seller(): User
    {
        return User::factory()->create(['role' => 'seller', 'project' => 'happy', 'is_active' => true]);
    }

    /** @return array<string,mixed> */
    private function sheetData(string $id, int $historyCount): array
    {
        $settings     = ['price' => 9.9, 'quantity' => 1, 'amzFeePct' => 17, 'shipPerItem' => 2];
        $productTypes = [[
            'id' => 'pt1', 'name' => 'Football Jersey', 'phoi' => 0, 'shown' => true,
            'customizeInfos' => [],
            'sizes' => [
                ['id' => 'sz1', 'label' => 'S', 'sizeAdd' => 1, 'itemCost' => 8.2],
                ['id' => 'sz2', 'label' => 'M', 'sizeAdd' => 2, 'itemCost' => 8.6],
            ],
        ]];

        $history = [];
        for ($v = $historyCount; $v >= 1; $v--) {
            $history[] = [
                'version'  => $v,
                'savedAt'  => now()->subMinutes($historyCount - $v)->toIso8601String(),
                'savedBy'  => "Seller {$v}",
                'settings' => $settings,
                'productTypes' => $productTypes,
            ];
        }

        return [
            'id' => $id, 'name' => "Bang gia {$id}", 'project' => 'happy', 'vendorRef' => 'VN3',
            'settings' => $settings, 'productTypes' => $productTypes, 'history' => $history,
        ];
    }

    private function seedSheet(string $id, int $historyCount): void
    {
        DB::table('price_sheets')->insert([
            'id' => $id, 'project' => 'happy', 'name' => "Bang gia {$id}",
            'data' => json_encode($this->sheetData($id, $historyCount)),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_backfill_copy_du_so_ban_va_dung_noi_dung(): void
    {
        $this->seedSheet('sheet_1', 12);

        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();

        $versions = DB::table('price_sheet_versions')->where('sheet_id', 'sheet_1')->get();
        $this->assertCount(12, $versions);

        // Bản mới nhất trong blob (version 12) phải là bản có số version cao nhất.
        $newest = DB::table('price_sheet_versions')->where('sheet_id', 'sheet_1')
            ->orderBy('version', 'desc')->first();
        $snapshot = json_decode($newest->data, true);
        $this->assertSame('Seller 12', $snapshot['savedBy']);
        $this->assertSame('Seller 12', $newest->saved_by);
        $this->assertCount(2, $snapshot['productTypes'][0]['sizes']);
    }

    /** Đường lùi: blob gốc KHÔNG bị đụng tới. */
    public function test_backfill_khong_xoa_history_trong_blob(): void
    {
        $this->seedSheet('sheet_1', 12);
        $before = DB::table('price_sheets')->where('id', 'sheet_1')->value('data');

        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();

        $after = json_decode(DB::table('price_sheets')->where('id', 'sheet_1')->value('data'), true);
        $this->assertCount(12, $after['history']);
        $this->assertSame(
            json_decode($before, true)['history'],
            $after['history'],
            'Nội dung history trong blob phải nguyên vẹn từng phần tử.'
        );
    }

    public function test_backfill_dien_luon_cac_cot_tong_hop(): void
    {
        $this->seedSheet('sheet_1', 3);

        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();

        $row = DB::table('price_sheets')->where('id', 'sheet_1')->first();
        $this->assertSame(2, (int) $row->size_count);
        $this->assertSame('VN3', $row->vendor_ref);
        $this->assertSame(['Football Jersey'], json_decode($row->product_type_names, true));
    }

    /** Chạy lại lần hai không được nhân đôi dữ liệu. */
    public function test_backfill_chay_lai_khong_tao_ban_trung(): void
    {
        $this->seedSheet('sheet_1', 5);

        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();
        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();

        $this->assertSame(5, DB::table('price_sheet_versions')->where('sheet_id', 'sheet_1')->count());
    }

    public function test_dry_run_khong_ghi_gi(): void
    {
        $this->seedSheet('sheet_1', 5);

        $this->artisan('pricesheets:backfill-versions', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame(0, DB::table('price_sheet_versions')->count());
        $this->assertNull(DB::table('price_sheets')->where('id', 'sheet_1')->value('product_type_names'));
    }

    public function test_bang_data_hong_khong_lam_chet_ca_lenh(): void
    {
        DB::table('price_sheets')->insert([
            'id' => 'sheet_hong', 'project' => 'happy', 'name' => 'Hong',
            'data' => 'khong-phai-json', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->seedSheet('sheet_1', 4);

        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();

        $this->assertSame(4, DB::table('price_sheet_versions')->where('sheet_id', 'sheet_1')->count());
    }

    /**
     * Sau backfill, panel Lịch sử đọc từ bảng riêng — và vẫn thấy đủ 12 bản.
     * Đây là điều người dùng thực sự kiểm được.
     */
    public function test_panel_lich_su_van_thay_du_sau_khi_backfill(): void
    {
        $this->seedSheet('sheet_1', 12);
        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();

        $versions = $this->actingAs($this->seller())
            ->getJson('/api/price-sheets/sheet_1/versions')
            ->assertOk()
            ->json();

        $this->assertCount(12, $versions);
        // Mới nhất đứng đầu, đúng như panel đang hiển thị.
        $this->assertSame('Seller 12', $versions[0]['savedBy']);
    }

    /**
     * Lần LƯU đầu tiên sau khi deploy cũng chính là một lần backfill: client cũ
     * còn gửi cả 20 snapshot, server nhận và khử trùng thay vì tạo bản sao.
     *
     * Dùng LẠI đúng 1 bộ `$payload` cho cả seed lẫn gửi lại — gọi `sheetData()`
     * hai lần độc lập (bản cũ) sinh `savedAt` khác nhau vì mỗi lần tính `now()`
     * mới; nếu lệnh backfill ở giữa tốn đủ 1 giây thật (dễ xảy ra trên CI chạy
     * MySQL thật, hiếm khi xảy ra ở SQLite tại chỗ) thì khoá khử trùng (chỉ
     * chính xác tới giây — xem SnapshotTime) không nhận ra trùng → ghi thêm
     * 5 bản mới → đếm ra 10 thay vì 5. Dùng chung 1 bộ dữ liệu loại bỏ hẳn phụ
     * thuộc vào đồng hồ thật.
     */
    public function test_luu_lai_khong_nhan_doi_lich_su_da_backfill(): void
    {
        $payload = $this->sheetData('sheet_1', 5);
        DB::table('price_sheets')->insert([
            'id' => 'sheet_1', 'project' => 'happy', 'name' => 'Bang gia sheet_1',
            'data' => json_encode($payload), 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();

        $this->actingAs($this->seller())->postJson('/api/price-sheets', $payload)->assertOk();

        $this->assertSame(5, DB::table('price_sheet_versions')->where('sheet_id', 'sheet_1')->count());
    }

    /** Giữ đúng 20 bản mới nhất, không để bảng lịch sử phình vô hạn. */
    public function test_chi_giu_20_ban_moi_nhat(): void
    {
        $this->seedSheet('sheet_1', 20);
        $this->artisan('pricesheets:backfill-versions')->assertSuccessful();

        $sheet = $this->sheetData('sheet_1', 20);
        // Giá phải KHÁC bản mới nhất: từ bản autosave trở đi, snapshot trùng
        // nội dung với bản gần nhất bị bỏ qua (Seller hay bấm Lưu nhiều lần
        // cho chắc — xem PriceSheetAutosaveTest). Ở đây ta đang kiểm việc
        // PRUNE còn đúng 20 bản, nên snapshot thứ 21 phải là bản thật.
        $sheet['history'] = [[
            'version' => 21,
            'savedAt' => now()->addMinutes(5)->toIso8601String(),
            'savedBy' => 'Seller moi',
            'settings' => ['price' => 12.9, 'quantity' => 1, 'amzFeePct' => 17, 'shipPerItem' => 2],
            'productTypes' => $sheet['productTypes'],
        ]];

        $this->actingAs($this->seller())->postJson('/api/price-sheets', $sheet)->assertOk();

        $this->assertSame(20, DB::table('price_sheet_versions')->where('sheet_id', 'sheet_1')->count());
        $this->assertSame(
            'Seller moi',
            DB::table('price_sheet_versions')->where('sheet_id', 'sheet_1')
                ->orderBy('version', 'desc')->value('saved_by')
        );
    }
}
