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
 * Mục 16 — Chặn ghi đè mất dữ liệu giữa hai người cùng sửa một bảng tính giá.
 *
 * Trước bản này upsert là last-write-wins tuyệt đối: chỉ ghi `updated_at`, không
 * so version. A mở bảng lúc 9h, B sửa và lưu lúc 10h, A lưu lúc 10h05 → toàn bộ
 * thay đổi của B biến mất không một lời cảnh báo. Nặng hơn lỗi kéo-mất-giá ở mục
 * 01 vì hoàn toàn im lặng, và Seller không còn Google Sheet để đối chiếu.
 */
#[Group('milestone-16')]
class PriceSheetConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    private function seller(string $project = 'happy'): User
    {
        return User::factory()->create([
            'role' => 'seller', 'project' => $project, 'is_active' => true,
        ]);
    }

    /** @return array Payload bảng tính giá tối thiểu nhưng đủ thật để lưu. */
    private function sheetPayload(string $id, string $name, int $version = null): array
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
            'history' => [],
        ];

        if ($version !== null) {
            $payload['expectedVersion'] = $version;
        }

        return $payload;
    }

    private function seedSheet(string $id): int
    {
        $user = $this->seller();
        $this->actingAs($user)->postJson('/api/price-sheets', $this->sheetPayload($id, 'Ban goc'));

        return (int) DB::table('price_sheets')->where('id', $id)->value('version');
    }

    public function test_luu_lan_dau_tra_ve_version_1(): void
    {
        $user = $this->seller();

        $res = $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->sheetPayload('sheet_new', 'Bang moi'));

        $res->assertOk()->assertJsonPath('version', 1);
    }

    public function test_version_tang_sau_moi_lan_luu(): void
    {
        $user = $this->seller();
        $this->actingAs($user)->postJson('/api/price-sheets', $this->sheetPayload('sheet_a', 'v1'));

        $res = $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->sheetPayload('sheet_a', 'v2', 1));

        $res->assertOk()->assertJsonPath('version', 2);
    }

    /** Mục tiêu: "Không ghi đè mất thay đổi của người khác". */
    public function test_luu_voi_version_cu_bi_tu_choi_va_du_lieu_nguoi_kia_con_nguyen(): void
    {
        $v1 = $this->seedSheet('sheet_x');

        $a = $this->seller();
        $b = $this->seller();

        // A lưu trước → version lên 2, tên đổi thành "Ban cua A"
        $this->actingAs($a)
            ->postJson('/api/price-sheets', $this->sheetPayload('sheet_x', 'Ban cua A', $v1))
            ->assertOk();

        // B vẫn cầm version cũ (v1) vì mở bảng từ trước
        $res = $this->actingAs($b)
            ->postJson('/api/price-sheets', $this->sheetPayload('sheet_x', 'Ban cua B', $v1));

        $res->assertStatus(409)
            ->assertJsonPath('code', 'version_conflict')
            ->assertJsonPath('currentVersion', $v1 + 1);

        // Điều quan trọng nhất: công của A vẫn còn nguyên trong DB
        $this->assertSame('Ban cua A', DB::table('price_sheets')->where('id', 'sheet_x')->value('name'));
    }

    /** 409 phải kèm bản hiện hành để người dùng xem được trước khi quyết định. */
    public function test_phan_hoi_409_kem_ban_hien_hanh_de_nguoi_dung_doi_chieu(): void
    {
        $v1 = $this->seedSheet('sheet_y');
        $a  = $this->seller();
        $b  = $this->seller();

        $this->actingAs($a)->postJson('/api/price-sheets', $this->sheetPayload('sheet_y', 'Ban cua A', $v1));

        $res = $this->actingAs($b)
            ->postJson('/api/price-sheets', $this->sheetPayload('sheet_y', 'Ban cua B', $v1));

        $res->assertStatus(409);
        $this->assertSame('Ban cua A', $res->json('current.name'));
        $this->assertNotNull($res->json('updatedAt'));
    }

    /** Mục tiêu: "Ghi đè có chủ đích vẫn làm được". */
    public function test_force_cho_phep_ghi_de_sau_khi_da_xem_canh_bao(): void
    {
        $v1 = $this->seedSheet('sheet_z');
        $a  = $this->seller();
        $b  = $this->seller();

        $this->actingAs($a)->postJson('/api/price-sheets', $this->sheetPayload('sheet_z', 'Ban cua A', $v1));

        $payload = $this->sheetPayload('sheet_z', 'Ban cua B', $v1);
        $payload['force'] = true;

        $this->actingAs($b)->postJson('/api/price-sheets', $payload)->assertOk();

        $this->assertSame('Ban cua B', DB::table('price_sheets')->where('id', 'sheet_z')->value('name'));
    }

    /**
     * Mục tiêu: "Client cũ không bị hỏng".
     * Deploy backend trước frontend là chuyện bình thường — bản frontend cũ
     * không gửi `expectedVersion` thì phải chạy y như trước.
     */
    public function test_client_cu_khong_gui_expected_version_van_luu_binh_thuong(): void
    {
        $v1 = $this->seedSheet('sheet_legacy');
        $a  = $this->seller();
        $b  = $this->seller();

        $this->actingAs($a)->postJson('/api/price-sheets', $this->sheetPayload('sheet_legacy', 'Ban cua A', $v1));

        // Không có expectedVersion trong payload
        $this->actingAs($b)
            ->postJson('/api/price-sheets', $this->sheetPayload('sheet_legacy', 'Ban client cu'))
            ->assertOk();

        $this->assertSame('Ban client cu', DB::table('price_sheets')->where('id', 'sheet_legacy')->value('name'));
    }

    /** Mục tiêu: "Danh sách tự làm mới" — client cần tín hiệu để biết mà tải lại. */
    public function test_luu_thanh_cong_thi_phat_tin_hieu_cho_may_khac(): void
    {
        Event::fake([PriceSheetChanged::class]);
        $user = $this->seller();

        $this->actingAs($user)
            ->postJson('/api/price-sheets', $this->sheetPayload('sheet_bc', 'Bang moi'))
            ->assertOk();

        Event::assertDispatched(PriceSheetChanged::class, fn ($e) => $e->sheetId === 'sheet_bc' && $e->action === 'saved');
    }

    public function test_xoa_cung_phat_tin_hieu(): void
    {
        $this->seedSheet('sheet_del');
        Event::fake([PriceSheetChanged::class]);
        $user = $this->seller();

        $this->actingAs($user)->deleteJson('/api/price-sheets/sheet_del')->assertOk();

        Event::assertDispatched(PriceSheetChanged::class, fn ($e) => $e->action === 'deleted');
    }

    /**
     * Kênh phải tách theo project: Seller project khác không được nhận tín hiệu
     * (và cũng không suy ra được project khác đang có bao nhiêu bảng).
     */
    public function test_tin_hieu_phat_dung_kenh_cua_project(): void
    {
        Event::fake([PriceSheetChanged::class]);
        $user = $this->seller('happy');

        $this->actingAs($user)->postJson('/api/price-sheets', $this->sheetPayload('sheet_ch', 'Bang'));

        Event::assertDispatched(PriceSheetChanged::class, function ($e) {
            $channels = $e->broadcastOn();
            return $channels[0]->name === 'price-sheets.happy';
        });
    }

    /** Payload broadcast KHÔNG được mang nội dung bảng giá — kênh Pusher là public. */
    public function test_payload_broadcast_khong_mang_noi_dung_bang_gia(): void
    {
        Event::fake([PriceSheetChanged::class]);
        $user = $this->seller();

        $this->actingAs($user)->postJson('/api/price-sheets', $this->sheetPayload('sheet_pl', 'Bang'));

        Event::assertDispatched(PriceSheetChanged::class, function ($e) {
            $payload = $e->broadcastWith();
            return array_keys($payload) === ['id', 'action', 'version', 'updatedBy']
                && !isset($payload['data'], $payload['productTypes'], $payload['settings']);
        });
    }
}
