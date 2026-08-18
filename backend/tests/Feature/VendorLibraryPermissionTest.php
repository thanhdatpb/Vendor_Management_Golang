<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PR-S2 — Chỉ Vendor (Staff B) được ghi đè thư viện Vendor.
 *
 * ⛔ ĐỎ LÀ ĐÚNG cho tới khi Milestone S xong. Hiện tại hai route
 *   POST /api/vendor-library            (saveLibrary)
 *   POST /api/vendor-library/restore-backup
 * KHÔNG có middleware role nào, trong khi các route ghi nhẹ ngay bên cạnh
 * (sample-status, best-seller, upload-images) đều đã khai
 * ->middleware('role:staff_b,vendor') — dấu hiệu rõ ràng là bị bỏ sót.
 *
 * Hệ quả: bất kỳ token đăng nhập nào cũng POST một JSON hợp lệ để thay sạch
 * toàn bộ blob `vendor_library` của cả hệ thống. Đây cũng là điều kiện tiên
 * quyết của PR-C4: audit log vô nghĩa nếu ai cũng ghi đè được cả blob.
 */
#[Group('pending')]
#[Group('milestone-s')]
class VendorLibraryPermissionTest extends TestCase
{
    use RefreshDatabase;

    private const ORIGINAL = '[{"filename":"goc.xlsx","pricing":[{"kyHieu":"VN3","productType":"Football Jersey","size":"S","pricing1":8.2}]}]';

    protected function setUp(): void
    {
        parent::setUp();
        DB::table('vendor_library')->insert([
            'data'       => self::ORIGINAL,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'is_active' => true]);
    }

    private function currentBlob(): string
    {
        return DB::table('vendor_library')->orderBy('id')->value('data');
    }

    public function test_role_khong_duoc_phep_khong_ghi_de_duoc_thu_vien(): void
    {
        foreach (['seller', 'staff_a', 'csf', 'pd', 'marvel'] as $role) {
            $this->actingAs($this->user($role))
                ->postJson('/api/vendor-library', [['filename' => 'pha_hoai.xlsx', 'pricing' => []]])
                ->assertStatus(403);

            $this->assertSame(self::ORIGINAL, $this->currentBlob(), "Role {$role} đã ghi được thư viện");
        }
    }

    public function test_chi_vendor_va_staff_b_ghi_duoc_thu_vien(): void
    {
        foreach (['vendor', 'staff_b'] as $role) {
            $this->actingAs($this->user($role))
                ->postJson('/api/vendor-library', [['filename' => "moi_{$role}.xlsx", 'pricing' => []]])
                ->assertOk();

            $this->assertStringContainsString("moi_{$role}.xlsx", $this->currentBlob());
        }
    }

    public function test_role_khong_duoc_phep_khong_khoi_phuc_backup_duoc(): void
    {
        foreach (['seller', 'csf', 'pd', 'marvel'] as $role) {
            $this->actingAs($this->user($role))
                ->postJson('/api/vendor-library/restore-backup', [])
                ->assertStatus(403);

            $this->assertSame(self::ORIGINAL, $this->currentBlob(), "Role {$role} khôi phục được backup");
        }
    }

    public function test_khach_chua_dang_nhap_khong_ghi_duoc(): void
    {
        $this->postJson('/api/vendor-library', [])->assertStatus(401);
        $this->assertSame(self::ORIGINAL, $this->currentBlob());
    }

    public function test_moi_role_van_doc_duoc_thu_vien(): void
    {
        // Siết quyền GHI, không được chặn nhầm quyền ĐỌC của CSF/PD/Marvel —
        // đây chính là công việc hằng ngày của họ.
        foreach (['seller', 'vendor', 'csf', 'pd', 'marvel', 'admin'] as $role) {
            $this->actingAs($this->user($role))->getJson('/api/vendor-library')->assertOk();
        }
    }
}
