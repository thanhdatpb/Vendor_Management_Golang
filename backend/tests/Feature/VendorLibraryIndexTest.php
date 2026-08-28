<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PR-D2 (mục 17) — Index thư viện nhẹ, không lộ giá, và mở bảng thứ hai không tải lại.
 *
 * `vendor_library` là MỘT dòng longText cho toàn hệ thống, `getLibrary` trả
 * nguyên blob. Mỗi lần Seller mở một bảng giá là một lần tải cả thư viện — ảnh,
 * notes, generalInfo — chỉ để lấy danh sách size và giá vốn.
 */
#[Group('milestone-d')]
class VendorLibraryIndexTest extends TestCase
{
    use RefreshDatabase;

    /** Họ trường giá có trong thư viện — khớp parseHappyCreativeLibrary ở frontend. */
    private const PRICE_KEYS = [
        'pricing1', 'pricing2',
        'eco_price', 'eco_total', 'eco_price_item2',
        'ground_price', 'ground_total', 'ground_price_item2',
        'express_price', 'express_total', 'express_price_item2',
        'twoday_price', 'twoday_total', 'twoday_price_item2',
        'overnight_price', 'overnight_total', 'overnight_price_item2',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('vendor_library')->insert([
            'data'       => json_encode($this->library()),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function user(string $role, ?string $project = null): User
    {
        return User::factory()->create(['role' => $role, 'project' => $project, 'is_active' => true]);
    }

    /**
     * Thư viện mẫu: 2 vendor cùng cấp tên phôi "Football Jersey" (đúng ca lỗi
     * mục 03) + 1 file thuộc project khác + phần dữ liệu nặng mà bảng tính giá
     * không cần (ảnh, notes, generalInfo).
     */
    private function library(): array
    {
        $heavy = str_repeat('https://cdn.example/anh-san-pham-rat-dai.jpg ', 200);

        return [
            [
                'filename'    => 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
                'generalInfo' => [[
                    'kyHieu' => 'VN3', 'productType' => 'Football Jersey',
                    'chatLieu' => 'Polyester 150gsm', 'notes' => $heavy,
                    'images' => [$heavy], 'linkFolder' => 'https://drive.example/vn3',
                ]],
                'pricing' => [
                    [
                        'kyHieu' => 'VN3', 'productType' => 'Football Jersey', 'size' => 'S',
                        'optional' => 'Basic', 'pricing1' => 8.2, 'pricing2' => 8.9,
                        'eco_price' => 4.1, 'eco_total' => 12.3, 'eco_price_item2' => 1.1,
                    ],
                    [
                        'kyHieu' => 'VN3', 'productType' => 'Football Jersey', 'size' => 'M',
                        'pricing1' => 8.6, 'eco_price' => 4.1,
                    ],
                    // Vendor KHÁC, cùng tên phôi — phải là record riêng.
                    [
                        'kyHieu' => 'CN1', 'productType' => 'Football Jersey', 'size' => 'S',
                        'pricing1' => 6.4, 'eco_price' => 3.2,
                    ],
                    // Dòng không có size → bảng tính giá không dùng được.
                    [
                        'kyHieu' => 'VN3', 'productType' => 'Football Jersey', 'size' => 'N/A',
                        'pricing1' => 9.9,
                    ],
                ],
            ],
            [
                'filename' => 'HappyC_VendorLibrary_p.creative_2026-06.xlsx',
                'pricing'  => [[
                    'kyHieu' => 'CR7', 'productType' => 'Night Light', 'size' => 'One Size',
                    'pricing1' => 3.3,
                ]],
            ],
        ];
    }

    public function test_index_tra_du_record_size_va_gia_von_cho_seller(): void
    {
        $records = $this->actingAs($this->user('seller', 'happy'))
            ->getJson('/api/vendor-library/index')
            ->assertOk()
            ->json();

        // 2 vendor cùng tên phôi ⇒ 2 record riêng, không gom làm một.
        $this->assertCount(2, $records);
        $this->assertSame(
            ['CN1', 'VN3'],
            collect($records)->pluck('vendorCode')->sort()->values()->all()
        );

        $vn3 = collect($records)->firstWhere('vendorCode', 'VN3');
        $this->assertNotEmpty($vn3['recordKey']);
        $this->assertSame('Football Jersey', $vn3['productType']);
        // Dòng size "N/A" bị loại, còn đúng S và M.
        $this->assertSame(['S', 'M'], array_column($vn3['sizes'], 'size'));
        $this->assertSame(8.2, $vn3['sizes'][0]['pricing1']);
        $this->assertSame(4.1, $vn3['sizes'][0]['eco_price']);
    }

    /**
     * mục 02 — "info phôi" (chất liệu, ảnh, chi tiết size, AVG TG) đi kèm mỗi
     * record cho bảng tính giá, lấy từ `generalInfo` đã có sẵn thay vì phải
     * nhập thêm dữ liệu mới. Không phải giá nên vẫn xuất hiện kể cả role
     * không thấy giá.
     */
    public function test_index_kem_theo_info_phoi_tu_generalInfo(): void
    {
        $records = $this->actingAs($this->user('pd', 'happy'))
            ->getJson('/api/vendor-library/index?project=happy')
            ->assertOk()
            ->json();

        $vn3 = collect($records)->firstWhere('vendorCode', 'VN3');
        $this->assertSame('Polyester 150gsm', $vn3['chatLieu']);
        $this->assertNotEmpty($vn3['image']);

        // CN1 không có generalInfo — không được vỡ, các trường info phôi rỗng
        // thay vì thiếu khoá (client dựa vào khoá này tồn tại để hiện UI).
        $cn1 = collect($records)->firstWhere('vendorCode', 'CN1');
        $this->assertSame('', $cn1['chatLieu']);
        $this->assertSame('', $cn1['image']);
        $this->assertSame('', $cn1['avgTimeVendor']);
        $this->assertSame('', $cn1['avgTimeActual']);
        $this->assertSame('', $cn1['chiTietSize']);
    }

    public function test_index_nhe_hon_han_blob_day_du(): void
    {
        $seller = $this->user('seller', 'happy');

        $full  = strlen($this->actingAs($seller)->getJson('/api/vendor-library')->getContent());
        $index = strlen($this->actingAs($seller)->getJson('/api/vendor-library/index')->getContent());

        $this->assertLessThan(
            $full / 2,
            $index,
            'Index phải nhỏ hơn nhiều lần blob — nếu không thì chưa giải được bài hiệu suất.'
        );
    }

    public function test_role_khong_co_quyen_gia_nhan_index_khong_chua_khoa_gia_nao(): void
    {
        foreach (['csf', 'pd', 'marvel'] as $role) {
            $body = $this->actingAs($this->user($role, 'happy'))
                ->getJson('/api/vendor-library/index?project=happy')
                ->assertOk()
                ->getContent();

            foreach (self::PRICE_KEYS as $key) {
                $this->assertStringNotContainsString($key, $body, "Role {$role} vẫn nhận được `{$key}`");
            }

            // Lọc giá không được làm hỏng việc tra cứu: size và mã vendor vẫn còn.
            $this->assertStringContainsString('"vendorCode"', $body);
            $this->assertStringContainsString('"size"', $body);
        }
    }

    public function test_mo_bang_thu_hai_khong_tai_lai_thu_vien(): void
    {
        $seller = $this->user('seller', 'happy');

        $first = $this->actingAs($seller)->getJson('/api/vendor-library/index')->assertOk();
        $etag  = $first->headers->get('ETag');
        $this->assertNotEmpty($etag, 'Thiếu ETag thì client không có cách nào hỏi "có gì mới không".');

        $second = $this->actingAs($seller)
            ->withHeaders(['If-None-Match' => $etag])
            ->getJson('/api/vendor-library/index');

        $second->assertStatus(304);
        $this->assertSame('', $second->getContent());
    }

    public function test_thu_vien_doi_thi_etag_doi_theo(): void
    {
        $seller = $this->user('seller', 'happy');
        $etag   = $this->actingAs($seller)->getJson('/api/vendor-library/index')->headers->get('ETag');

        DB::table('vendor_library')->update(['updated_at' => now()->addMinute()]);

        $this->actingAs($seller)
            ->withHeaders(['If-None-Match' => $etag])
            ->getJson('/api/vendor-library/index')
            ->assertOk();
    }

    /**
     * ETag phải khác nhau giữa role thấy giá và role không thấy giá — nếu trùng,
     * một proxy (hoặc chính cache của ta) có thể trả bản CÓ giá cho PD.
     */
    public function test_etag_khac_nhau_giua_role_thay_gia_va_khong_thay_gia(): void
    {
        $priced = $this->actingAs($this->user('seller', 'happy'))
            ->getJson('/api/vendor-library/index?project=happy')->headers->get('ETag');

        $stripped = $this->actingAs($this->user('pd', 'happy'))
            ->getJson('/api/vendor-library/index?project=happy')->headers->get('ETag');

        $this->assertNotSame($priced, $stripped);
    }

    public function test_loc_dung_project_cua_user(): void
    {
        $records = $this->actingAs($this->user('seller', 'creative'))
            ->getJson('/api/vendor-library/index')
            ->assertOk()
            ->json();

        $this->assertSame(['Night Light'], collect($records)->pluck('productType')->all());
    }

    /** Role hẹp không được tự nới phạm vi bằng query param. */
    public function test_seller_khong_doi_duoc_project_bang_query_param(): void
    {
        $records = $this->actingAs($this->user('seller', 'happy'))
            ->getJson('/api/vendor-library/index?project=creative')
            ->assertOk()
            ->json();

        $this->assertSame(
            ['Football Jersey', 'Football Jersey'],
            collect($records)->pluck('productType')->all()
        );
    }
}
