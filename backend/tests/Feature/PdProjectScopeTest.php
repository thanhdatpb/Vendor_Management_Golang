<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * PD được tách khỏi project: tra cứu thư viện của MỌI project.
 *
 * Cột `project` của tài khoản PD vẫn còn trong DB (không migration, không ai bị
 * đăng xuất) — chỉ là không dùng để phân quyền nữa.
 */
#[Group('role-visibility')]
class PdProjectScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        DB::table('vendor_library')->insert([
            'data' => json_encode([
                [
                    'filename' => 'Thu vien P.happy.xlsx',
                    'pricing'  => [['kyHieu' => 'VN3', 'productType' => 'Football Jersey', 'size' => 'S', 'pricing1' => 8.2]],
                ],
                [
                    'filename' => 'Thu vien P.creative.xlsx',
                    'pricing'  => [['kyHieu' => 'CR7', 'productType' => 'Night Light', 'size' => 'One Size', 'pricing1' => 3.3]],
                ],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** PD gán project Happy nhưng vẫn xem được thư viện của Creative. */
    public function test_pd_xem_duoc_thu_vien_cua_project_khac(): void
    {
        $pd = User::factory()->create(['role' => 'pd', 'project' => 'Happy Project', 'is_active' => true]);

        $records = $this->actingAs($pd)
            ->getJson('/api/vendor-library/index?project=creative')
            ->assertOk()
            ->json();

        $this->assertSame(['Night Light'], collect($records)->pluck('productType')->all());
    }

    /** Không truyền project → thấy hết. */
    public function test_pd_khong_truyen_project_thi_thay_tat_ca(): void
    {
        $pd = User::factory()->create(['role' => 'pd', 'project' => 'Happy Project', 'is_active' => true]);

        $records = $this->actingAs($pd)->getJson('/api/vendor-library/index')->assertOk()->json();

        $this->assertSame(
            ['Football Jersey', 'Night Light'],
            collect($records)->pluck('productType')->sort()->values()->all()
        );
    }

    /** Tài khoản PD không có project cũng dùng được bình thường. */
    public function test_pd_khong_co_project_van_xem_duoc(): void
    {
        $pd = User::factory()->create(['role' => 'pd', 'project' => null, 'is_active' => true]);

        $this->actingAs($pd)->getJson('/api/vendor-library/index')->assertOk()->assertJsonCount(2);
    }

    /** Seller thì KHÔNG được nới phạm vi — quy tắc cũ giữ nguyên. */
    public function test_seller_van_bi_ghim_theo_project(): void
    {
        $seller = User::factory()->create(['role' => 'seller', 'project' => 'happy', 'is_active' => true]);

        $records = $this->actingAs($seller)
            ->getJson('/api/vendor-library/index?project=creative')
            ->assertOk()
            ->json();

        $this->assertSame(['Football Jersey'], collect($records)->pluck('productType')->all());
    }

    // ── Admin tạo / sửa tài khoản PD ────────────────────────────────────────

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'project' => null, 'is_active' => true]);
    }

    /** Tab PD trong màn hình Nhân sự gửi `project: null` — không được 422. */
    public function test_tao_tai_khoan_pd_khong_can_project(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd.moi@happyc.test', 'full_name' => 'PD Moi', 'role' => 'pd', 'project' => null,
            ])
            ->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'pd.moi@happyc.test', 'role' => 'pd', 'project' => null]);
    }

    /** Seller thì vẫn bắt buộc có project. */
    public function test_tao_seller_van_bat_buoc_project(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'seller.moi@happyc.test', 'full_name' => 'Seller Moi', 'role' => 'seller', 'project' => null,
            ])
            ->assertStatus(422);
    }

    /**
     * Sửa tên một PD đang có project KHÔNG được âm thầm xoá project đó.
     * Dữ liệu cũ giữ nguyên — đây là điều kiện để không phải chạy migration.
     */
    public function test_sua_pd_khong_xoa_project_dang_co(): void
    {
        $pd = User::factory()->create([
            'role' => 'pd', 'project' => 'Happy Project', 'full_name' => 'Ten Cu', 'is_active' => true,
        ]);

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/users/{$pd->id}", ['full_name' => 'Ten Moi', 'role' => 'pd', 'project' => null])
            ->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'id' => $pd->id, 'full_name' => 'Ten Moi', 'project' => 'Happy Project',
        ]);
    }

    /** Hai tài khoản PD cùng email, khác project (dữ liệu cũ) vẫn tồn tại được. */
    public function test_du_lieu_pd_cu_nhieu_project_khong_bi_pha(): void
    {
        User::factory()->create(['email' => 'pd@happyc.test', 'role' => 'pd', 'project' => 'Happy Project', 'is_active' => true]);

        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd@happyc.test', 'full_name' => 'PD', 'role' => 'pd', 'project' => 'Creative Project',
            ])
            ->assertSuccessful();

        $this->assertSame(2, User::where('email', 'pd@happyc.test')->where('role', 'pd')->count());
    }
}
