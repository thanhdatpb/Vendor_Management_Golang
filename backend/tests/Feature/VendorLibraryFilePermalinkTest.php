<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Link riêng cho MỘT file thư viện — `/api/vendor-library/files/{id}`.
 *
 * Endpoint này là đường MỚI vào cùng dữ liệu mà `getLibrary` đang phục vụ, nên
 * nó phải tự thực thi phân quyền chứ không trông chờ UI giấu cột. Bộ test này
 * canh đúng ba điều đó:
 *
 *   1. Phạm vi project  — ngoài phạm vi trả 403, KHÔNG phải 404 (người nhận
 *      link cần biết file có thật để còn đi hỏi đúng người).
 *   2. Trường giá       — CSF/PD/Marvel không được nhận bất kỳ khoá giá nào.
 *      Assertion đặt trên RAW BODY chứ không chỉ trên key: dữ liệu thư viện là
 *      JSON lồng nhau, kiểm theo key rất dễ sót nhánh con.
 *   3. AVG TG           — CSF vẫn xem được, PD và Marvel thì không.
 */
class VendorLibraryFilePermalinkTest extends TestCase
{
    use RefreshDatabase;

    /** Họ khoá giá — khớp VendorFieldVisibility::PRICE_FIELDS. */
    private const PRICE_KEYS = [
        'pricing1', 'pricing2',
        'eco_price', 'eco_total', 'eco_price_item2',
        'ground_price', 'ground_total',
        'express_price', 'express_total',
        'twoday_price', 'overnight_price',
        'targetCost', 'economyPrice', 'totalPrice', 'itemCost',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->seedLibrary([
            $this->file('file_happy_1', 'P.HAPPY_Baby Bodysuit', ['happy'], '2026-09-15T14:29:00Z'),
            $this->file('file_global_1', 'P.GLOBAL_Baseball Jersey', ['global'], '2026-09-12T09:00:00Z'),
        ]);
    }

    // ── Dữ liệu dựng sẵn ────────────────────────────────────────────

    private function seedLibrary(array $files): void
    {
        DB::table('vendor_library')->insert([
            'data'       => json_encode($files, JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function file(string $id, string $filename, array $projects, string $importedAt): array
    {
        return [
            'id'          => $id,
            'filename'    => $filename,
            'importedAt'  => $importedAt,
            'title'       => 'Baby Bodysuit',
            'projects'    => $projects,
            'generalInfo' => [[
                'id'            => $id . '_row1',
                'vendorName'    => 'US1',
                'productType'   => 'Baby Bodysuit_US1W',
                'chatLieu'      => '100% combed ringspun cotton',
                'avgTimeVendor' => 'Thời gian sản xuất: 3-5 bds',
                'avgTimeActual' => 'Thời gian sản xuất: 2 bds',
                'linkFolder'    => 'https://drive.example/us1',
            ]],
            'pricing'     => [[
                'kyHieu'       => 'US1',
                'productType'  => 'Baby Bodysuit_US1W',
                'size'         => 'NB - 24M',
                'pricing1'     => 8.2,
                'pricing2'     => 8.9,
                'eco_price'    => 4.1,
                'eco_total'    => 12.3,
                'linkTemplate' => 'https://drive.example/template',
            ]],
        ];
    }

    private function user(string $role, ?string $project = null): User
    {
        return User::factory()->create([
            'role'      => $role,
            'project'   => $project,
            'is_active' => true,
        ]);
    }

    // ── Tìm thấy / không tìm thấy ───────────────────────────────────

    public function test_admin_lay_duoc_dung_file_theo_id(): void
    {
        $body = $this->actingAs($this->user('admin'))
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->assertOk()
            ->json();

        $this->assertSame('file_happy_1', $body['id']);
        $this->assertSame('P.HAPPY_Baby Bodysuit', $body['filename']);
        $this->assertCount(1, $body['generalInfo']);
    }

    public function test_tra_ve_so_dem_de_client_khong_tu_dem_moi_noi_mot_kieu(): void
    {
        $body = $this->actingAs($this->user('admin'))
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->assertOk()
            ->json();

        $this->assertSame(1, $body['counts']['generalInfo']);
        $this->assertSame(1, $body['counts']['pricing']);
    }

    public function test_id_khong_ton_tai_tra_404(): void
    {
        $this->actingAs($this->user('admin'))
            ->getJson('/api/vendor-library/files/khong-he-co')
            ->assertNotFound();
    }

    public function test_chua_dang_nhap_thi_khong_vao_duoc(): void
    {
        $this->getJson('/api/vendor-library/files/file_happy_1')
            ->assertUnauthorized();
    }

    // ── Phạm vi project ─────────────────────────────────────────────

    public function test_seller_khac_project_nhan_403_chu_khong_phai_404(): void
    {
        $this->actingAs($this->user('seller', 'global'))
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->assertForbidden();
    }

    public function test_seller_dung_project_xem_duoc(): void
    {
        $this->actingAs($this->user('seller', 'happy'))
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->assertOk()
            ->assertJsonPath('id', 'file_happy_1');
    }

    public function test_role_xem_moi_project_khong_bi_chan_boi_cot_project_cua_tai_khoan(): void
    {
        // PD/CSF/Marvel phục vụ nhiều project; cột `project` của tài khoản không
        // còn dùng để phân quyền thư viện (xem indexProjectKey ở controller).
        foreach (['csf', 'pd', 'marvel', 'admin', 'vendor'] as $role) {
            $this->actingAs($this->user($role, 'global'))
                ->getJson('/api/vendor-library/files/file_happy_1')
                ->assertOk();
        }
    }

    // ── Giá không được rời server ───────────────────────────────────

    public function test_role_khong_co_quyen_gia_nhan_body_khong_chua_khoa_gia_nao(): void
    {
        foreach (['csf', 'pd', 'marvel'] as $role) {
            $body = $this->actingAs($this->user($role))
                ->getJson('/api/vendor-library/files/file_happy_1')
                ->assertOk()
                ->getContent();

            foreach (self::PRICE_KEYS as $key) {
                $this->assertStringNotContainsString(
                    $key,
                    $body,
                    "Role {$role} nhận được khoá giá `{$key}` trong response."
                );
            }
        }
    }

    public function test_khoa_phi_gia_cua_dong_pricing_van_con_de_suy_ra_link_template(): void
    {
        $body = $this->actingAs($this->user('csf'))
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->assertOk()
            ->json();

        $this->assertSame('US1', $body['pricing'][0]['kyHieu']);
        $this->assertSame('NB - 24M', $body['pricing'][0]['size']);
        $this->assertSame('https://drive.example/template', $body['pricing'][0]['linkTemplate']);
    }

    public function test_role_co_quyen_van_nhan_du_gia(): void
    {
        foreach (['admin', 'seller', 'vendor'] as $role) {
            $body = $this->actingAs($this->user($role, 'happy'))
                ->getJson('/api/vendor-library/files/file_happy_1')
                ->assertOk()
                ->json();

            $this->assertSame(8.2, $body['pricing'][0]['pricing1'], "Role {$role} mất cột giá.");
        }
    }

    // ── AVG TG ──────────────────────────────────────────────────────

    public function test_csf_xem_duoc_avg_tg_con_pd_va_marvel_thi_khong(): void
    {
        $csf = $this->actingAs($this->user('csf'))
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->assertOk()
            ->json();
        $this->assertArrayHasKey('avgTimeVendor', $csf['generalInfo'][0]);

        foreach (['pd', 'marvel'] as $role) {
            $body = $this->actingAs($this->user($role))
                ->getJson('/api/vendor-library/files/file_happy_1')
                ->assertOk()
                ->json();

            $this->assertArrayNotHasKey('avgTimeVendor', $body['generalInfo'][0], "Role {$role} thấy AVG TG (Vendor).");
            $this->assertArrayNotHasKey('avgTimeActual', $body['generalInfo'][0], "Role {$role} thấy AVG TG (Thực tế).");
        }
    }

    // ── ETag ────────────────────────────────────────────────────────

    public function test_mo_lai_cung_link_thi_nhan_304(): void
    {
        $admin = $this->user('admin');

        $etag = $this->actingAs($admin)
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->assertOk()
            ->headers->get('ETag');

        $this->assertNotEmpty($etag);

        $this->actingAs($admin)
            ->withHeaders(['If-None-Match' => $etag])
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->assertStatus(304);
    }

    public function test_etag_khac_nhau_giua_role_thay_gia_va_role_khong(): void
    {
        // Cùng một ETag cho 2 role khác quyền là mở đường cho proxy/cache trả
        // bản có giá cho người không được xem giá.
        $withPrices = $this->actingAs($this->user('admin'))
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->headers->get('ETag');

        $withoutPrices = $this->actingAs($this->user('csf'))
            ->getJson('/api/vendor-library/files/file_happy_1')
            ->headers->get('ETag');

        $this->assertNotSame($withPrices, $withoutPrices);
    }

    // ── Tra theo tên (cứu link cũ) ──────────────────────────────────

    public function test_tra_theo_ten_file_tra_ve_id_de_chuyen_huong(): void
    {
        $this->actingAs($this->user('admin'))
            ->getJson('/api/vendor-library/files/by-name/' . rawurlencode('P.HAPPY_Baby Bodysuit'))
            ->assertOk()
            ->assertJsonPath('id', 'file_happy_1');
    }

    public function test_tra_theo_ten_bo_qua_hoa_thuong_va_duoi_xlsx(): void
    {
        $this->actingAs($this->user('admin'))
            ->getJson('/api/vendor-library/files/by-name/' . rawurlencode('p.happy_baby bodysuit.xlsx'))
            ->assertOk()
            ->assertJsonPath('id', 'file_happy_1');
    }

    public function test_trung_ten_thi_lay_ban_import_gan_nhat(): void
    {
        DB::table('vendor_library')->delete();
        $this->seedLibrary([
            $this->file('file_cu', 'Baby Bodysuit', [], '2026-01-01T00:00:00Z'),
            $this->file('file_moi', 'Baby Bodysuit', [], '2026-09-15T14:29:00Z'),
        ]);

        $this->actingAs($this->user('admin'))
            ->getJson('/api/vendor-library/files/by-name/' . rawurlencode('Baby Bodysuit'))
            ->assertOk()
            ->assertJsonPath('id', 'file_moi');
    }

    public function test_tra_theo_ten_cung_bi_chan_theo_pham_vi_project(): void
    {
        $this->actingAs($this->user('seller', 'global'))
            ->getJson('/api/vendor-library/files/by-name/' . rawurlencode('P.HAPPY_Baby Bodysuit'))
            ->assertForbidden();
    }

    // ── Thông báo mang theo file_id ─────────────────────────────────

    public function test_thong_bao_cap_nhat_thu_vien_mang_theo_file_id(): void
    {
        $vendor = $this->user('vendor');
        $admin  = $this->user('admin');

        // VendorLibraryDiff so sánh theo các dòng `pricing` (xem indexRows), nên
        // "có thay đổi" nghĩa là thêm/sửa dòng giá — thêm dòng generalInfo thôi
        // thì không có thông báo nào được phát.
        $updated = $this->file('file_happy_1', 'P.HAPPY_Baby Bodysuit', ['happy'], '2026-09-16T10:00:00Z');
        $updated['pricing'][] = [
            'kyHieu'      => 'US2',
            'productType' => 'Baby Bodysuit_US2W',
            'size'        => 'NB - 24M',
            'pricing1'    => 7.9,
        ];

        $this->actingAs($vendor)->postJson('/api/vendor-library', [$updated])->assertOk();

        $notification = DB::table('notifications')
            ->where('user_id', $admin->id)
            ->where('type', 'library_updated')
            ->first();

        $this->assertNotNull($notification, 'Admin phải nhận thông báo cập nhật thư viện.');
        $data = json_decode((string) $notification->data, true);
        $this->assertSame('file_happy_1', $data['file_id']);
    }
}
