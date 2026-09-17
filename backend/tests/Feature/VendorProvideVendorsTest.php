<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Vendor cung cấp vendor cho request bằng cách tìm / dán link file thư viện.
 *
 *   1. `GET /api/vendor-library/files` — danh sách file GỌN cho ô tìm file:
 *      đủ để tìm (tên, Product Type, vendor), KHÔNG một khoá giá nào, và giữ
 *      đúng phạm vi project như link riêng của file.
 *   2. Thông báo `vendor_assigned` gửi Seller nêu tên các vendor + file nguồn,
 *      và không báo "đã cung cấp 0 vendor" khi Vendor gỡ hết.
 */
class VendorProvideVendorsTest extends TestCase
{
    use RefreshDatabase;

    private const PRICE_KEYS = [
        'pricing1', 'pricing2', 'eco_price', 'eco_total', 'ground_total',
        'express_total', 'twoday_price', 'overnight_price',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('vendor_library')->insert([
            'data' => json_encode([
                $this->file('file_wood', 'HC_Wooden Ornament', ['global'], '2026-09-09T08:00:00Z', 'CN1', 'Wooden Ornament'),
                $this->file('file_cc', 'HC_Comfort Colors 1717', [], '2026-07-27T06:02:00Z', 'US1', 'Comfort Colors 1717'),
                $this->file('file_happy', 'HC_Embroidered Sweatshirt', ['happy'], '2026-08-21T03:00:00Z', 'US2', 'Embroidered Sweatshirt'),
            ], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function file(string $id, string $filename, array $projects, string $importedAt, string $vendor, string $type): array
    {
        return [
            'id'          => $id,
            'filename'    => $filename,
            'importedAt'  => $importedAt,
            'title'       => $type,
            'projects'    => $projects,
            'generalInfo' => [
                ['id' => "{$id}_g1", 'kyHieu' => $vendor, 'vendorName' => $vendor, 'productType' => $type, 'chatLieu' => 'Cotton'],
                ['id' => "{$id}_g2", 'kyHieu' => '', 'vendorName' => $vendor, 'productType' => $type . ' Mini'],
            ],
            'pricing'     => [
                ['kyHieu' => $vendor, 'productType' => $type, 'size' => 'S', 'pricing1' => 5.1, 'eco_price' => 1.2, 'eco_total' => 6.3, 'ground_total' => 7.1],
            ],
        ];
    }

    private function user(string $role, ?string $project = null): User
    {
        return User::factory()->create(['role' => $role, 'project' => $project, 'is_active' => true]);
    }

    // ── Danh sách file gọn ─────────────────────────────────────────

    public function test_vendor_thay_moi_file_kem_du_thong_tin_de_tim(): void
    {
        $list = $this->actingAs($this->user('vendor'))
            ->getJson('/api/vendor-library/files')
            ->assertOk()
            ->json();

        $this->assertSame(['file_wood', 'file_happy', 'file_cc'], array_column($list, 'id'), 'File nhập gần nhất lên đầu');

        $wood = $list[0];
        $this->assertSame('HC_Wooden Ornament', $wood['filename']);
        $this->assertSame(['CN1'], $wood['vendors'], 'Tên vendor gom trùng');
        $this->assertSame(['Wooden Ornament', 'Wooden Ornament Mini'], $wood['productTypes']);
        $this->assertSame(['generalInfo' => 2, 'pricing' => 1], $wood['counts']);
    }

    public function test_danh_sach_khong_chua_khoa_gia_voi_bat_ky_role_nao(): void
    {
        foreach (['vendor', 'admin', 'seller', 'csf', 'pd'] as $role) {
            $body = $this->actingAs($this->user($role, 'global'))
                ->getJson('/api/vendor-library/files')
                ->assertOk()
                ->getContent();

            foreach (self::PRICE_KEYS as $key) {
                $this->assertStringNotContainsString($key, $body, "Role {$role} nhận được khoá giá `{$key}`.");
            }
        }
    }

    public function test_seller_chi_thay_file_trong_pham_vi_project(): void
    {
        $ids = array_column(
            $this->actingAs($this->user('seller', 'global'))->getJson('/api/vendor-library/files')->assertOk()->json(),
            'id'
        );

        $this->assertContains('file_wood', $ids);
        $this->assertContains('file_cc', $ids, 'File chia sẻ cho mọi project');
        $this->assertNotContains('file_happy', $ids);
    }

    public function test_chua_dang_nhap_khong_lay_duoc_danh_sach(): void
    {
        $this->getJson('/api/vendor-library/files')->assertUnauthorized();
    }

    public function test_route_danh_sach_khong_nuot_link_by_name_va_link_theo_id(): void
    {
        $vendor = $this->user('vendor');
        $this->actingAs($vendor)->getJson('/api/vendor-library/files/file_cc')->assertOk()->assertJsonPath('id', 'file_cc');
        $this->actingAs($vendor)->getJson('/api/vendor-library/files/by-name/' . rawurlencode('HC_Comfort Colors 1717'))->assertOk()->assertJsonPath('id', 'file_cc');
    }

    public function test_mo_lai_voi_etag_cu_nhan_304(): void
    {
        $vendor = $this->user('vendor');
        $etag = $this->actingAs($vendor)->getJson('/api/vendor-library/files')->assertOk()->headers->get('ETag');

        $this->actingAs($vendor)
            ->getJson('/api/vendor-library/files', ['If-None-Match' => $etag])
            ->assertStatus(304);
    }

    // ── Thông báo cho Seller ───────────────────────────────────────

    private function approvedProductOf(User $seller): int
    {
        $admin = $this->user('admin');
        $created = $this->actingAs($seller)->postJson('/api/products', [
            'product_type'    => 'Wooden Ornament',
            'total_cost'      => '5-6',
            'material'        => 'Wood',
            'print_area'      => 'Front',
            'production_time' => '3-5',
            'shipping_time'   => '5-8',
            'good_review'     => 'Ok',
            'bad_review'      => 'None',
        ])->assertStatus(201)->json();

        $this->actingAs($seller)->postJson("/api/products/{$created['id']}/submit")->assertOk();
        $this->actingAs($admin)->postJson("/api/admin/products/{$created['id']}/approve", ['approved' => true])->assertOk();

        return (int) $created['id'];
    }

    private function row(string $name, string $size, string $fileId = 'file_wood', string $fileName = 'HC_Wooden Ornament'): array
    {
        return [
            'id' => "{$fileId}_{$name}_{$size}", 'excel_row_id' => "{$fileId}_{$name}", 'is_excel' => true,
            'name' => $name, 'size' => $size, 'eco_total' => 5.5,
            'source_file_id' => $fileId, 'source_file_name' => $fileName,
        ];
    }

    public function test_thong_bao_neu_ten_cac_vendor_va_file_nguon(): void
    {
        $seller    = $this->user('seller', 'global');
        $productId = $this->approvedProductOf($seller);

        $this->actingAs($this->user('vendor'))
            ->postJson("/api/products/{$productId}/assign-vendors", ['vendors' => [
                $this->row('CN1', '3in'),
                $this->row('CN1', '4in'),
                $this->row('US1', 'S', 'file_cc', 'HC_Comfort Colors 1717'),
            ]])
            ->assertOk();

        $n = Notification::where('user_id', $seller->id)->where('type', 'vendor_assigned')->latest('id')->first();
        $this->assertNotNull($n);
        $this->assertStringContainsString('2 vendor (CN1, US1)', $n->body);
        $this->assertStringContainsString('HC_Wooden Ornament', $n->body);

        $data = is_array($n->data) ? $n->data : json_decode($n->data, true);
        $this->assertSame(['CN1', 'US1'], $data['vendor_names']);
        $this->assertSame(['file_wood', 'file_cc'], $data['file_ids']);
    }

    public function test_go_het_vendor_thi_khong_bao_da_cung_cap(): void
    {
        $seller    = $this->user('seller', 'global');
        $productId = $this->approvedProductOf($seller);
        $before    = Notification::where('user_id', $seller->id)->where('type', 'vendor_assigned')->count();

        $this->actingAs($this->user('vendor'))
            ->postJson("/api/products/{$productId}/assign-vendors", ['vendors' => []])
            ->assertOk()
            ->assertJsonPath('assigned_vendors', []);

        $this->assertSame($before, Notification::where('user_id', $seller->id)->where('type', 'vendor_assigned')->count());
    }
}
