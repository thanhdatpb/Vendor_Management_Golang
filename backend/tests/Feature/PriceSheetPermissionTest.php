<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PR-S1 — Bảng tính giá chỉ Admin + Seller/StaffA được đụng vào.
 *
 * Trước bản này, PriceSheetController::seesAllProjects() có sẵn chuỗi
 * 'marvel'/'staffb'/'vendor' và 3 route /price-sheets không có middleware
 * role nào → Marvel/CSF/PD/StaffB/Vendor đều đọc/ghi/xoá được MỌI bảng giá.
 */
#[Group('milestone-s')]
class PriceSheetPermissionTest extends TestCase
{
    use RefreshDatabase;

    /** Role không được đụng vào bảng tính giá: 3 role chỉ-xem + StaffB/Vendor. */
    private const READ_ONLY_ROLES = ['marvel', 'csf', 'pd', 'staffb', 'vendor'];

    private function user(string $role, ?string $project = null): User
    {
        return User::factory()->create(['role' => $role, 'project' => $project, 'is_active' => true]);
    }

    private function seedSheet(string $id, ?string $project): void
    {
        DB::table('price_sheets')->insert([
            'id'         => $id,
            'project'    => $project,
            'name'       => "Bang gia {$id}",
            'data'       => json_encode([
                'id' => $id, 'name' => "Bang gia {$id}", 'project' => $project,
                'settings' => ['price' => 19.9], 'productTypes' => [], 'history' => [],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_role_chi_doc_khong_doc_duoc_danh_sach_bang_gia(): void
    {
        $this->seedSheet('sheet_happy', 'happy');
        $this->seedSheet('sheet_creative', 'creative');

        foreach (self::READ_ONLY_ROLES as $role) {
            $this->actingAs($this->user($role))
                ->getJson('/api/price-sheets')
                ->assertStatus(403);
        }
    }

    public function test_marvel_co_quyen_Y_HET_csf(): void
    {
        // Ràng buộc "Marvel = CSF, chỉ khác nhãn hiển thị" (commit 7f22022)
        // được chốt thành test để không tái diễn việc Marvel âm thầm rộng quyền hơn.
        $this->seedSheet('sheet_happy', 'happy');

        $marvel = $this->actingAs($this->user('marvel'))->getJson('/api/price-sheets');
        $csf    = $this->actingAs($this->user('csf'))->getJson('/api/price-sheets');

        $this->assertSame($csf->getStatusCode(), $marvel->getStatusCode());
        $this->assertSame($csf->getContent(), $marvel->getContent());
    }

    public function test_role_chi_doc_khong_ghi_duoc_bang_gia(): void
    {
        $this->seedSheet('sheet_happy', 'happy');
        $before = DB::table('price_sheets')->where('id', 'sheet_happy')->value('data');

        foreach (self::READ_ONLY_ROLES as $role) {
            $this->actingAs($this->user($role))
                ->postJson('/api/price-sheets', [
                    'id'           => 'sheet_happy',
                    'name'         => "ghi de boi {$role}",
                    'project'      => 'happy',
                    'settings'     => ['price' => 0],
                    'productTypes' => [],
                ])
                ->assertStatus(403);
        }

        $this->assertSame($before, DB::table('price_sheets')->where('id', 'sheet_happy')->value('data'));
    }

    public function test_role_chi_doc_khong_tao_moi_duoc_bang_gia(): void
    {
        foreach (self::READ_ONLY_ROLES as $role) {
            $this->actingAs($this->user($role))
                ->postJson('/api/price-sheets', ['id' => "sheet_{$role}", 'settings' => [], 'productTypes' => []])
                ->assertStatus(403);
        }

        $this->assertSame(0, DB::table('price_sheets')->count());
    }

    public function test_role_chi_doc_khong_xoa_duoc_bang_gia(): void
    {
        $this->seedSheet('sheet_happy', 'happy');

        foreach (self::READ_ONLY_ROLES as $role) {
            $this->actingAs($this->user($role))
                ->deleteJson('/api/price-sheets/sheet_happy')
                ->assertStatus(403);
        }

        $this->assertDatabaseHas('price_sheets', ['id' => 'sheet_happy']);
    }

    public function test_role_lam_viec_that_van_dung_duoc_binh_thuong(): void
    {
        // Siết quyền không được chặn nhầm người đang dùng hằng ngày.
        $this->seedSheet('sheet_happy', 'happy');

        $this->actingAs($this->user('seller', 'happy'))->getJson('/api/price-sheets')->assertOk();
        $this->actingAs($this->user('admin'))->getJson('/api/price-sheets')->assertOk();
    }

    public function test_seller_clone_sang_project_khac_van_bi_ep_ve_project_cua_minh(): void
    {
        // Mục 08 (clone) — bản clone của Seller không được lọt sang project khác.
        $this->actingAs($this->user('seller', 'happy'))
            ->postJson('/api/price-sheets', [
                'id'           => 'sheet_clone',
                'name'         => 'Ban sao',
                'project'      => 'creative',
                'cloneFromId'  => 'sheet_goc',
                'settings'     => [],
                'productTypes' => [],
            ])
            ->assertOk();

        $this->assertSame('happy', DB::table('price_sheets')->where('id', 'sheet_clone')->value('project'));
    }
}
