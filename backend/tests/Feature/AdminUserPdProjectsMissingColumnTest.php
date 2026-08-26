<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * Deploy code TRƯỚC khi migration kịp chạy — tình huống có thật, đã lặp lại
 * nhiều lần (last_seen_at 2026-08-18, created_by 2026-08-19). Quy trình deploy
 * thủ công (CLAUDE.md §7) không có bước `php artisan migrate` gắn liền, nên
 * mọi cột mới đều có một khoảng thời gian tồn tại trong CODE mà chưa có trong
 * DB. `pd_projects` lặp lại đúng sự cố đó trên production 2026-08-26: index()
 * select thẳng tên cột → 1054 Unknown column → 500 → trang Quản Lý Nhân Sự
 * trắng danh sách toàn bộ (không chỉ tab PD).
 */
#[Group('role-visibility')]
class AdminUserPdProjectsMissingColumnTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'project' => null, 'is_active' => true]);
    }

    /** Mô phỏng DB production chưa chạy migration: bỏ hẳn cột đi. */
    private function dropPdProjectsColumn(): void
    {
        Schema::table('users', function ($table) {
            $table->dropColumn('pd_projects');
        });

        $this->assertFalse(
            Schema::hasColumn('users', 'pd_projects'),
            'Test này chỉ có nghĩa khi cột đã thật sự bị bỏ đi'
        );
    }

    public function test_index_khong_500_khi_thieu_cot_pd_projects(): void
    {
        $this->dropPdProjectsColumn();
        User::factory()->create(['role' => 'pd', 'full_name' => 'PD A', 'is_active' => true]);

        $rows = $this->actingAs($this->admin())->getJson('/api/admin/users')->assertOk()->json('users');
        $row = collect($rows)->firstWhere('full_name', 'PD A');

        $this->assertSame([], $row['pd_projects'], 'Thiếu cột thì trả mảng rỗng, không phải lỗi');
    }

    public function test_tao_pd_khong_500_khi_thieu_cot_pd_projects(): void
    {
        $this->dropPdProjectsColumn();

        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd.moi@happyc.test', 'full_name' => 'PD Moi', 'role' => 'pd',
                'pd_projects' => ['Happy Project'],
            ])
            ->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'pd.moi@happyc.test', 'role' => 'pd']);
    }

    public function test_sua_pd_khong_500_khi_thieu_cot_pd_projects(): void
    {
        $this->dropPdProjectsColumn();
        $pd = User::factory()->create(['role' => 'pd', 'full_name' => 'Ten Cu', 'is_active' => true]);

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/users/{$pd->id}", [
                'full_name' => 'Ten Moi', 'role' => 'pd', 'pd_projects' => ['Global Project'],
            ])
            ->assertSuccessful();

        $this->assertSame('Ten Moi', $pd->fresh()->full_name);
    }

    /** Có cột thì vẫn phải ghi đúng — bản vá không được làm hỏng tính năng. */
    public function test_khi_co_cot_thi_van_ghi_dung_pd_projects(): void
    {
        $this->assertTrue(Schema::hasColumn('users', 'pd_projects'));

        $this->actingAs($this->admin())
            ->postJson('/api/admin/users', [
                'email' => 'pd.co.cot@happyc.test', 'full_name' => 'PD Co Cot', 'role' => 'pd',
                'pd_projects' => ['Happy Project', 'Creative Project'],
            ])
            ->assertSuccessful();

        $saved = User::where('email', 'pd.co.cot@happyc.test')->first();
        $this->assertSame(['Happy Project', 'Creative Project'], $saved->pd_projects);
    }
}
