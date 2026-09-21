<?php

namespace Tests\Feature;

use App\Events\PriceSheetChanged;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * TỰ LƯU BẢNG TÍNH GIÁ — ghi liên tục nhưng KHÔNG làm phình lịch sử.
 *
 * Trước bản này Seller phải bấm "Lưu" mới giữ được công, nên họ bấm rất nhiều
 * lần cho chắc: một bảng thật đã có tới 17 phiên bản, mà trần chỉ là 20 —
 * những mốc thật sự đáng giữ bị đẩy ra ngoài bởi chính các lần lưu phòng thân.
 *
 * Hợp đồng được khoá ở đây:
 *   • payload KHÔNG kèm `history`  → không sinh phiên bản nào;
 *   • cờ `autosave`                → không bắn realtime (Pusher) theo nhịp gõ;
 *   • snapshot trùng nội dung bản mới nhất → bỏ qua, không tạo bản trùng;
 *   • autosave vẫn phải qua cửa `expectedVersion` và cửa quyền như lưu thường.
 */
#[Group('pricesheet-autosave')]
class PriceSheetAutosaveTest extends TestCase
{
    use RefreshDatabase;

    private function seller(string $project = 'happy'): User
    {
        return User::factory()->create([
            'role' => 'seller', 'project' => $project, 'is_active' => true,
        ]);
    }

    /** Payload tối thiểu nhưng đủ thật. `history` để null = lượt autosave. */
    private function payload(string $id, string $name, ?int $version = null, ?array $history = null, array $extra = []): array
    {
        $payload = [
            'id'      => $id,
            'name'    => $name,
            'project' => 'happy',
            'settings' => [
                'price' => 19.9, 'quantity' => 1, 'shipPerOrder' => 0, 'shipPerItem' => 0,
                'couponUsd' => 0, 'couponPct' => 0, 'variableFeePct' => 0, 'amzFeePct' => 17,
                'importTax' => 0,
            ],
            'productTypes' => [[
                'id' => 'pt_1', 'name' => 'T-shirt', 'phoi' => '2', 'shown' => true,
                'customizeInfos' => [],
                'sizes' => [['id' => 'sz_1', 'label' => 'M', 'sizeAdd' => '1', 'itemCost' => '5', 'customize' => []]],
            ]],
        ];

        if ($version !== null) {
            $payload['expectedVersion'] = $version;
        }
        if ($history !== null) {
            $payload['history'] = $history;
        }

        return array_merge($payload, $extra);
    }

    /** Một snapshot lịch sử như client dựng ở PriceSheetWorkspace.handleSave. */
    private function snapshot(string $savedAt, $price = 19.9): array
    {
        return [
            'version'  => 1,
            'savedAt'  => $savedAt,
            'savedBy'  => 'Seller',
            'settings' => ['price' => $price, 'quantity' => 1],
            'productTypes' => [['id' => 'pt_1', 'name' => 'T-shirt', 'sizes' => []]],
        ];
    }

    private function versionCount(string $id): int
    {
        return (int) DB::table('price_sheet_versions')->where('sheet_id', $id)->count();
    }

    public function test_autosave_khong_tao_phien_ban_moi(): void
    {
        $user = $this->seller();

        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_a', 'Ban dau', null, [$this->snapshot('2026-09-20T02:00:00.000Z')]))
            ->assertOk();
        $this->assertSame(1, $this->versionCount('sheet_a'));

        // 5 lượt autosave liên tiếp: nội dung phải đổi, lịch sử thì không.
        for ($i = 1; $i <= 5; $i++) {
            $this->actingAs($user)
                ->postJson('/api/price-sheets', $this->payload('sheet_a', "Autosave $i", $i, null, ['autosave' => true]))
                ->assertOk();
        }

        $this->assertSame(1, $this->versionCount('sheet_a'), 'Autosave KHÔNG được sinh phiên bản');
        $this->assertSame('Autosave 5', DB::table('price_sheets')->where('id', 'sheet_a')->value('name'));
    }

    public function test_autosave_van_luu_noi_dung_va_tang_version(): void
    {
        $user = $this->seller();
        $this->actingAs($user)->postJson('/api/price-sheets', $this->payload('sheet_b', 'v1'))->assertOk();

        $res = $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_b', 'v2 autosave', 1, null, ['autosave' => true]));

        $res->assertOk()->assertJsonPath('version', 2);
        $sheet = json_decode(DB::table('price_sheets')->where('id', 'sheet_b')->value('data'), true);
        $this->assertSame('v2 autosave', $sheet['name']);
        $this->assertSame(19.9, $sheet['settings']['price']);
    }

    public function test_autosave_khong_ban_realtime_con_luu_thuong_thi_co(): void
    {
        Event::fake([PriceSheetChanged::class]);
        $user = $this->seller();

        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_c', 'v1'))
            ->assertOk();
        Event::assertDispatched(PriceSheetChanged::class, 1);

        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_c', 'v2', 1, null, ['autosave' => true]))
            ->assertOk();

        // Vẫn đúng 1 — lượt autosave không bắn thêm lần nào.
        Event::assertDispatched(PriceSheetChanged::class, 1);
    }

    public function test_autosave_van_bi_chan_boi_xung_dot_phien_ban(): void
    {
        $user = $this->seller();
        $this->actingAs($user)->postJson('/api/price-sheets', $this->payload('sheet_d', 'v1'))->assertOk();
        $this->actingAs($user)->postJson('/api/price-sheets', $this->payload('sheet_d', 'v2', 1))->assertOk();

        // Máy khác vẫn cầm version 1 → autosave KHÔNG được âm thầm ghi đè.
        $res = $this->actingAs($this->seller())
            ->postJson('/api/price-sheets', $this->payload('sheet_d', 'ban cu', 1, null, ['autosave' => true]));

        $res->assertStatus(409)->assertJsonPath('code', 'version_conflict');
        $this->assertSame('v2', DB::table('price_sheets')->where('id', 'sheet_d')->value('name'));
    }

    public function test_autosave_van_chan_role_khong_duoc_phep(): void
    {
        $csf = User::factory()->create(['role' => 'csf', 'project' => 'happy', 'is_active' => true]);

        $this->actingAs($csf)
            ->postJson('/api/price-sheets', $this->payload('sheet_e', 'CSF thu ghi', null, null, ['autosave' => true]))
            ->assertStatus(403);

        $this->assertDatabaseMissing('price_sheets', ['id' => 'sheet_e']);
    }

    public function test_snapshot_trung_noi_dung_khong_tao_ban_moi(): void
    {
        $user = $this->seller();

        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_f', 'v1', null, [$this->snapshot('2026-09-20T02:00:00.000Z')]))
            ->assertOk();
        $this->assertSame(1, $this->versionCount('sheet_f'));

        // Bấm Lưu lần nữa: thời điểm khác, nội dung y hệt → không đáng một bản.
        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_f', 'v1', 1, [$this->snapshot('2026-09-20T02:05:00.000Z')]))
            ->assertOk();

        $this->assertSame(1, $this->versionCount('sheet_f'), 'Snapshot trùng nội dung không được tạo bản mới');
    }

    public function test_snapshot_doi_noi_dung_van_tao_ban_moi(): void
    {
        $user = $this->seller();

        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_g', 'v1', null, [$this->snapshot('2026-09-20T02:00:00.000Z', 19.9)]))
            ->assertOk();

        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_g', 'v2', 1, [$this->snapshot('2026-09-20T02:05:00.000Z', 24.9)]))
            ->assertOk();

        $this->assertSame(2, $this->versionCount('sheet_g'));
    }

    /**
     * Client cũ gửi CẢ 20 snapshot mỗi lần lưu. Khử trùng theo savedAt vẫn phải
     * chạy như trước, và các bản trùng nội dung liền kề trong đó cũng bị gộp.
     */
    public function test_client_cu_gui_ca_lich_su_van_khong_tao_ban_trung(): void
    {
        $user = $this->seller();
        $history = [
            $this->snapshot('2026-09-20T02:10:00.000Z', 24.9),
            $this->snapshot('2026-09-20T02:05:00.000Z', 19.9),
            $this->snapshot('2026-09-20T02:00:00.000Z', 19.9),
        ];

        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_h', 'v1', null, $history))
            ->assertOk();

        // 3 snapshot gửi lên nhưng hai bản 19.9 liền nhau chỉ đáng một bản.
        $this->assertSame(2, $this->versionCount('sheet_h'));

        // Gửi lại đúng lịch sử đó (client cũ làm vậy mỗi lần lưu) → không đẻ thêm.
        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_h', 'v2', 1, $history))
            ->assertOk();

        $this->assertSame(2, $this->versionCount('sheet_h'));
    }

    public function test_autosave_tren_bang_moi_tao_chi_co_mot_dong(): void
    {
        $user = $this->seller();

        // Lượt tạo (từ màn danh sách) và lượt autosave đầu tiên của workspace.
        $this->actingAs($user)->postJson('/api/price-sheets', $this->payload('sheet_i', 'Bang moi'))->assertOk();
        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->payload('sheet_i', 'Bang moi da sua', null, null, ['autosave' => true]))
            ->assertOk();

        $this->assertSame(1, DB::table('price_sheets')->where('id', 'sheet_i')->count());
        $this->assertSame(0, $this->versionCount('sheet_i'));
    }
}
