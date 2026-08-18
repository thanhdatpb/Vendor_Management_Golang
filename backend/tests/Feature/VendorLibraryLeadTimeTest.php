<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PD và Marvel KHÔNG được xem 2 cột "AVG TG"; CSF thì có.
 *
 * Assertion đặt trên RAW BODY chứ không chỉ trên key: ẩn cột ở UI là chưa đủ,
 * ai mở DevTools cũng đọc được response.
 */
#[Group('role-visibility')]
class VendorLibraryLeadTimeTest extends TestCase
{
    use RefreshDatabase;

    private const LEAD_TIME_KEYS = ['avgTimeVendor', 'avgTimeActual'];

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('vendor_library')->insert([
            'data' => json_encode([[
                'filename'    => 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
                'generalInfo' => [[
                    'id' => 'row-1', 'kyHieu' => 'VN3', 'vendorName' => 'Viet Nam 3',
                    'productType' => 'Football Jersey', 'chatLieu' => 'Polyester 150gsm',
                    'chiTietSize' => 'S-M-L-XL',
                    'avgTimeVendor' => 'Thoi gian sx: 3-5 normal days',
                    'avgTimeActual' => 'update sau 3 tuan chay phoi nay',
                    'notes' => 'Ghi chu', 'linkFolder' => 'https://drive.example/vn3',
                ]],
                'pricing' => [[
                    'kyHieu' => 'VN3', 'productType' => 'Football Jersey', 'size' => 'S', 'pricing1' => 8.2,
                ]],
            ]]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function user(string $role, ?string $project = 'Happy Project'): User
    {
        return User::factory()->create(['role' => $role, 'project' => $project, 'is_active' => true]);
    }

    private function library(string $role): string
    {
        return $this->actingAs($this->user($role))
            ->getJson('/api/vendor-library')
            ->assertOk()
            ->getContent();
    }

    public function test_pd_va_marvel_khong_nhan_duoc_hai_cot_thoi_gian(): void
    {
        foreach (['pd', 'marvel'] as $role) {
            $body = $this->library($role);

            foreach (self::LEAD_TIME_KEYS as $key) {
                $this->assertStringNotContainsString($key, $body, "Role {$role} vẫn nhận `{$key}`");
            }
            // Cả giá trị cũng không được lọt ra, không chỉ tên khoá.
            $this->assertStringNotContainsString('3-5 normal days', $body);
            $this->assertStringNotContainsString('update sau 3 tuan', $body);
        }
    }

    public function test_csf_van_thay_du_hai_cot_thoi_gian(): void
    {
        $body = $this->library('csf');

        foreach (self::LEAD_TIME_KEYS as $key) {
            $this->assertStringContainsString($key, $body, "CSF phải vẫn thấy `{$key}`");
        }
        $this->assertStringContainsString('3-5 normal days', $body);
    }

    public function test_role_lam_viec_van_thay_du(): void
    {
        foreach (['admin', 'vendor', 'seller'] as $role) {
            $this->assertStringContainsString('avgTimeVendor', $this->library($role), "Role {$role}");
        }
    }

    /** Lọc 2 cột không được làm hỏng phần còn lại của thư viện. */
    public function test_pd_van_nhan_du_thong_tin_tra_cuu(): void
    {
        $body = $this->library('pd');

        foreach (['Football Jersey', 'VN3', 'Polyester 150gsm', 'S-M-L-XL', 'linkFolder', 'Ghi chu'] as $needed) {
            $this->assertStringContainsString($needed, $body, "PD vẫn phải thấy: {$needed}");
        }
    }

    /** Thư viện trống thì không được nổ ở nhánh lọc. */
    public function test_thu_vien_trong_khong_lam_hong_request(): void
    {
        DB::table('vendor_library')->delete();

        $this->actingAs($this->user('pd'))->getJson('/api/vendor-library')->assertOk()->assertExactJson([]);
    }
}
