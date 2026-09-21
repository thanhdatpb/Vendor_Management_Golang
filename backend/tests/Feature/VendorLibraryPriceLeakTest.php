<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PR-S3 — Giá KHÔNG được rời server tới role không có quyền.
 *
 * ✅ Đã vá: `getLibrary` lọc giá bằng VendorFieldVisibility::filterPrices trước
 * khi trả về, nên CSF/PD/Marvel không còn nhận cột giá rồi trông chờ UI giấu đi.
 * CLAUDE.md §6.5: không lộ trường giá "trong props, response hay markup".
 *
 * Từ đây test nằm trong BỘ CHẶN MERGE — đỏ nghĩa là lỗ rò rỉ vừa mở lại.
 *
 * Assertion cố tình đặt trên RAW BODY chứ không chỉ trên key: dữ liệu thư viện
 * là blob JSON lồng nhau, kiểm theo key rất dễ sót nhánh con.
 */
#[Group('milestone-s')]
class VendorLibraryPriceLeakTest extends TestCase
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
            'data' => json_encode([[
                'filename'    => 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
                'generalInfo' => [[
                    'kyHieu' => 'VN3', 'productType' => 'Football Jersey',
                    'chatLieu' => 'Polyester 150gsm', 'linkFolder' => 'https://drive.example/vn3',
                ]],
                'pricing'     => [[
                    'kyHieu' => 'VN3', 'productType' => 'Football Jersey', 'size' => 'S',
                    'pricing1' => 8.2, 'pricing2' => 8.9,
                    'eco_price' => 4.1, 'eco_total' => 12.3, 'eco_price_item2' => 1.1,
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

    public function test_role_khong_co_quyen_gia_nhan_response_khong_chua_khoa_gia_nao(): void
    {
        foreach (['csf', 'pd', 'marvel'] as $role) {
            $body = $this->actingAs($this->user($role, 'happy'))
                ->getJson('/api/vendor-library')
                ->assertOk()
                ->getContent();

            foreach (self::PRICE_KEYS as $key) {
                $this->assertStringNotContainsString($key, $body, "Role {$role} vẫn nhận được trường giá `{$key}`");
            }
        }
    }

    public function test_role_khong_co_quyen_gia_van_nhan_du_thong_tin_nghiep_vu(): void
    {
        // Lọc giá không được làm hỏng công việc của CSF/PD: họ vẫn cần chất liệu,
        // size, mã vendor, link folder để tra cứu và tư vấn khách.
        $body = $this->actingAs($this->user('csf', 'happy'))
            ->getJson('/api/vendor-library')
            ->assertOk()
            ->getContent();

        foreach (['Football Jersey', 'VN3', 'Polyester 150gsm', 'linkFolder', '"size"'] as $needed) {
            $this->assertStringContainsString($needed, $body);
        }
    }

    public function test_role_co_quyen_van_nhan_du_gia(): void
    {
        foreach (['seller', 'vendor', 'admin'] as $role) {
            $body = $this->actingAs($this->user($role, 'happy'))
                ->getJson('/api/vendor-library')
                ->assertOk()
                ->getContent();

            $this->assertStringContainsString('pricing1', $body, "Role {$role} phải vẫn thấy giá");
        }
    }

    public function test_endpoint_index_nhe_cung_khong_lo_gia(): void
    {
        // PR-D2: index thư viện dành cho bảng tính giá cũng là nơi thực thi việc
        // lọc giá theo role — một chỗ giải hai bài (hiệu suất + rò rỉ giá).
        foreach (['csf', 'pd', 'marvel'] as $role) {
            $body = $this->actingAs($this->user($role, 'happy'))
                ->getJson('/api/vendor-library/index?project=happy')
                ->assertOk()
                ->getContent();

            foreach (self::PRICE_KEYS as $key) {
                $this->assertStringNotContainsString($key, $body);
            }
        }
    }
}
