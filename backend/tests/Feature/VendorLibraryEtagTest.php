<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * `GET /api/vendor-library` — đường nặng nhất của hệ thống phải biết nói 304.
 *
 * Màn hình thư viện tải NGUYÊN blob (vài MB) mỗi lần mount, và còn tự làm mới
 * nền mỗi lần người dùng quay lại tab hoặc Pusher báo có thay đổi. Không có
 * ETag thì mỗi lần như vậy là một lần tải lại cả thư viện dù không có gì đổi.
 *
 * `index`, `listFiles`, `showFile` đã có cơ chế này từ trước; đây là chỗ còn
 * sót lại — và là chỗ tốn kém nhất trong cả bốn.
 */
#[Group('perf')]
class VendorLibraryEtagTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('vendor_library')->insert([
            'data'       => json_encode([[
                'id'          => 'file-1',
                'filename'    => 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
                'importedAt'  => '2026-06-01T00:00:00.000Z',
                'generalInfo' => [[
                    'id' => 'g1', 'kyHieu' => 'VN3', 'productType' => 'Football Jersey',
                    'chatLieu' => 'Polyester 150gsm',
                    'avgTimeVendor' => '7-10 ngay', 'avgTimeActual' => '9 ngay',
                ]],
                'pricing'     => [[
                    'id' => 'p1', 'kyHieu' => 'VN3', 'productType' => 'Football Jersey',
                    'size' => 'S', 'pricing1' => 8.2, 'eco_price' => 4.1,
                ]],
            ]]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function user(string $role, ?string $project = null): User
    {
        return User::factory()->create(['role' => $role, 'project' => $project, 'is_active' => true]);
    }

    public function test_mo_lai_thu_vien_khong_tai_lai_blob(): void
    {
        $seller = $this->user('seller', 'happy');

        $first = $this->actingAs($seller)->getJson('/api/vendor-library')->assertOk();
        $etag  = $first->headers->get('ETag');
        $this->assertNotEmpty($etag, 'Thiếu ETag thì client không có cách nào hỏi "có gì mới không".');
        $this->assertSame('private, must-revalidate', $first->headers->get('Cache-Control'));

        $second = $this->actingAs($seller)
            ->withHeaders(['If-None-Match' => $etag])
            ->getJson('/api/vendor-library');

        $second->assertStatus(304);
        $this->assertSame('', $second->getContent(), '304 mà vẫn kèm body thì không tiết kiệm được gì.');
    }

    public function test_thu_vien_doi_thi_etag_doi_theo(): void
    {
        $seller = $this->user('seller', 'happy');
        $etag   = $this->actingAs($seller)->getJson('/api/vendor-library')->headers->get('ETag');

        DB::table('vendor_library')->update(['updated_at' => now()->addMinute()]);

        $this->actingAs($seller)
            ->withHeaders(['If-None-Match' => $etag])
            ->getJson('/api/vendor-library')
            ->assertOk();
    }

    /**
     * Body khác nhau theo role thì ETag bắt buộc phải khác nhau. Dùng chung một
     * ETag là mở đường cho việc phát bản CÓ giá cho role không được xem giá.
     */
    public function test_etag_khac_nhau_giua_role_thay_gia_va_khong_thay_gia(): void
    {
        $priced = $this->actingAs($this->user('seller', 'happy'))
            ->getJson('/api/vendor-library')->headers->get('ETag');

        $stripped = $this->actingAs($this->user('pd', 'happy'))
            ->getJson('/api/vendor-library')->headers->get('ETag');

        $this->assertNotSame($priced, $stripped);
    }

    /**
     * CSF xem được 2 cột AVG TG, PD thì không — hai bản body khác nhau, nên
     * ETag cũng phải khác. Cả hai đều không thấy giá, nên nếu ETag chỉ tính
     * theo "có giá / không giá" thì hai role này sẽ trùng nhau.
     */
    public function test_etag_khac_nhau_giua_csf_va_pd(): void
    {
        $csf = $this->actingAs($this->user('csf', 'happy'))
            ->getJson('/api/vendor-library')->headers->get('ETag');

        $pd = $this->actingAs($this->user('pd', 'happy'))
            ->getJson('/api/vendor-library')->headers->get('ETag');

        $this->assertNotSame($csf, $pd);
    }

    public function test_etag_cua_hai_phien_lien_tiep_khong_doi_khi_du_lieu_dung_yen(): void
    {
        $seller = $this->user('seller', 'happy');

        $a = $this->actingAs($seller)->getJson('/api/vendor-library')->headers->get('ETag');
        $b = $this->actingAs($seller)->getJson('/api/vendor-library')->headers->get('ETag');

        $this->assertSame($a, $b, 'ETag nhảy dù dữ liệu không đổi thì 304 không bao giờ xảy ra.');
    }

    public function test_thu_vien_trong_van_tra_etag_thay_vi_no(): void
    {
        DB::table('vendor_library')->delete();

        $response = $this->actingAs($this->user('seller', 'happy'))
            ->getJson('/api/vendor-library')
            ->assertOk();

        $this->assertSame([], $response->json());
        $this->assertNotEmpty($response->headers->get('ETag'));
    }
}
