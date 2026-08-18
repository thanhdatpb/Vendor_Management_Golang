<?php

namespace Tests\Feature;

use App\Events\VendorLibraryChanged;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * Mục 16 — Thư viện Vendor tự cập nhật, người dùng không phải F5.
 *
 * Trước bản này `fetchLibrary` ở client chỉ chạy lúc mount. Vendor import file
 * mới xong, người đang mở tab vẫn thấy bản cũ — và nếu họ mở bảng tính giá thì
 * tính trên giá vốn cũ mà không hay biết. Mâu thuẫn trực tiếp với yêu cầu của
 * CS: coi Hub là nguồn thông tin chính thức để tra cứu và tư vấn khách.
 */
#[Group('milestone-16')]
class VendorLibraryBroadcastTest extends TestCase
{
    use RefreshDatabase;

    private function vendorUser(): User
    {
        return User::factory()->create(['role' => 'vendor', 'is_active' => true]);
    }

    /** Thư viện tối thiểu có 1 file, 1 dòng generalInfo để sửa được từng field. */
    private function seedLibrary(string $rowId = 'row_1'): void
    {
        DB::table('vendor_library')->insert([
            'data' => json_encode([[
                'filename'    => 'P.Happy_vendor.xlsx',
                'generalInfo' => [[
                    'id' => $rowId, 'kyHieu' => 'VN3', 'productType' => 'T-shirt',
                    'chatLieu' => 'Cotton', 'sampleStatus' => 'no_sample', 'bestSeller' => false,
                ]],
                'pricing'     => [],
            ]], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_import_thu_vien_phat_tin_hieu(): void
    {
        Event::fake([VendorLibraryChanged::class]);
        $user = $this->vendorUser();

        $this->actingAs($user)
            ->postJson('/api/vendor-library', [['filename' => 'x.xlsx', 'generalInfo' => [], 'pricing' => []]])
            ->assertOk();

        Event::assertDispatched(VendorLibraryChanged::class, fn ($e) => $e->reason === 'import');
    }

    public function test_doi_trang_thai_sample_phat_tin_hieu(): void
    {
        $this->seedLibrary();
        Event::fake([VendorLibraryChanged::class]);
        $user = $this->vendorUser();

        $this->actingAs($user)
            ->postJson('/api/vendor-library/sample-status', ['rowId' => 'row_1', 'sampleStatus' => 'has_sample'])
            ->assertOk();

        Event::assertDispatched(VendorLibraryChanged::class, fn ($e) => $e->reason === 'sample-status');
    }

    public function test_doi_best_seller_phat_tin_hieu(): void
    {
        $this->seedLibrary();
        Event::fake([VendorLibraryChanged::class]);
        $user = $this->vendorUser();

        $this->actingAs($user)
            ->postJson('/api/vendor-library/best-seller', ['rowId' => 'row_1', 'isBestSeller' => true])
            ->assertOk();

        Event::assertDispatched(VendorLibraryChanged::class, fn ($e) => $e->reason === 'best-seller');
    }

    /** Thao tác thất bại thì KHÔNG được phát tín hiệu — client sẽ tải lại vô ích. */
    public function test_cap_nhat_that_bai_thi_khong_phat_tin_hieu(): void
    {
        $this->seedLibrary();
        Event::fake([VendorLibraryChanged::class]);
        $user = $this->vendorUser();

        $this->actingAs($user)
            ->postJson('/api/vendor-library/sample-status', ['rowId' => 'khong_ton_tai', 'sampleStatus' => 'has_sample'])
            ->assertNotFound();

        Event::assertNotDispatched(VendorLibraryChanged::class);
    }

    public function test_payload_chi_mang_ly_do_va_moc_thoi_gian(): void
    {
        Event::fake([VendorLibraryChanged::class]);
        $user = $this->vendorUser();

        $this->actingAs($user)
            ->postJson('/api/vendor-library', [['filename' => 'x.xlsx', 'generalInfo' => [], 'pricing' => []]]);

        Event::assertDispatched(VendorLibraryChanged::class, function ($e) {
            return array_keys($e->broadcastWith()) === ['reason', 'updatedAt'];
        });
    }

    public function test_phat_tren_kenh_vendor_library(): void
    {
        Event::fake([VendorLibraryChanged::class]);
        $user = $this->vendorUser();

        $this->actingAs($user)
            ->postJson('/api/vendor-library', [['filename' => 'x.xlsx', 'generalInfo' => [], 'pricing' => []]]);

        Event::assertDispatched(VendorLibraryChanged::class, function ($e) {
            return $e->broadcastOn()[0]->name === 'vendor-library';
        });
    }
}
