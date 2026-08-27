<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Phạm vi project của bảng tính giá — hành vi ĐANG CÓ, phải giữ nguyên.
 *
 * Đây là cổng chặn merge: mọi thay đổi ở PriceSheetController (siết quyền ở
 * Milestone S, tách summary ở PR-D1, thêm version ở mục 16) không được làm
 * Seller nhìn thấy hoặc ghi sang project khác.
 */
class PriceSheetProjectScopeTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, ?string $project = null): User
    {
        return User::factory()->create([
            'role'      => $role,
            'project'   => $project,
            'is_active' => true,
        ]);
    }

    private function seedSheet(string $id, ?string $project, array $extra = []): void
    {
        $sheet = array_merge([
            'id'           => $id,
            'name'         => "Bang gia {$id}",
            'project'      => $project,
            'settings'     => ['price' => 10, 'amzFeePct' => 17],
            'productTypes' => [],
            'history'      => [],
        ], $extra);

        DB::table('price_sheets')->insert([
            'id'         => $id,
            'project'    => $project,
            'name'       => $sheet['name'],
            'data'       => json_encode($sheet, JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_seller_chi_thay_bang_gia_cua_project_minh_va_bang_chua_gan_project(): void
    {
        $this->seedSheet('sheet_happy', 'happy');
        $this->seedSheet('sheet_creative', 'creative');
        $this->seedSheet('sheet_khong_project', null);

        $ids = collect($this->actingAs($this->user('seller', 'happy'))
            ->getJson('/api/price-sheets')
            ->assertOk()
            ->json())
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['sheet_happy', 'sheet_khong_project'], $ids);
    }

    public function test_admin_va_vendor_thay_moi_project(): void
    {
        $this->seedSheet('sheet_happy', 'happy');
        $this->seedSheet('sheet_creative', 'creative');

        foreach (['admin', 'vendor', 'staff_b'] as $role) {
            $this->assertCount(
                2,
                $this->actingAs($this->user($role))->getJson('/api/price-sheets')->assertOk()->json(),
                "Role {$role} phải thấy mọi project"
            );
        }
    }

    public function test_seller_luu_bang_gia_bi_ep_ve_project_cua_chinh_minh(): void
    {
        $this->actingAs($this->user('seller', 'happy'))
            ->postJson('/api/price-sheets', [
                'id'           => 'sheet_moi',
                'name'         => 'Thu ghi sang project khac',
                'project'      => 'creative',          // cố tình gửi project khác
                'settings'     => [],
                'productTypes' => [],
            ])
            ->assertOk();

        $this->assertSame('happy', DB::table('price_sheets')->where('id', 'sheet_moi')->value('project'));
    }

    public function test_luu_thieu_id_bi_tu_choi(): void
    {
        $this->actingAs($this->user('seller', 'happy'))
            ->postJson('/api/price-sheets', ['name' => 'Khong co id'])
            ->assertStatus(422);

        $this->assertSame(0, DB::table('price_sheets')->count());
    }

    public function test_seller_khong_ghi_de_duoc_bang_gia_cua_project_khac(): void
    {
        $this->seedSheet('sheet_creative', 'creative', ['name' => 'Ten goc']);

        $this->actingAs($this->user('seller', 'happy'))
            ->postJson('/api/price-sheets', [
                'id'           => 'sheet_creative',   // id của project khác
                'name'         => 'Bi cuop',
                'settings'     => [],
                'productTypes' => [],
            ])
            ->assertStatus(403);

        $this->assertSame('creative', DB::table('price_sheets')->where('id', 'sheet_creative')->value('project'));
        $this->assertSame('Ten goc', DB::table('price_sheets')->where('id', 'sheet_creative')->value('name'));
    }

    public function test_seller_khong_xoa_duoc_bang_gia_cua_project_khac(): void
    {
        $this->seedSheet('sheet_creative', 'creative');

        $this->actingAs($this->user('seller', 'happy'))
            ->deleteJson('/api/price-sheets/sheet_creative')
            ->assertStatus(403);

        $this->assertDatabaseHas('price_sheets', ['id' => 'sheet_creative']);
    }

    public function test_xoa_bang_khong_ton_tai_tra_404(): void
    {
        $this->actingAs($this->user('seller', 'happy'))
            ->deleteJson('/api/price-sheets/khong-co-that')
            ->assertStatus(404);
    }

    public function test_khach_chua_dang_nhap_khong_goi_duoc_api(): void
    {
        $this->getJson('/api/price-sheets')->assertStatus(401);
        $this->postJson('/api/price-sheets', ['id' => 'x'])->assertStatus(401);
    }
}
