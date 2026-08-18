<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

/**
 * Cột "Lần truy cập cuối" ở màn hình Quản Lý Nhân Sự.
 *
 * Middleware này chạy trên MỌI request đã đăng nhập nên phải giữ đúng ba điều:
 * chặn bớt số lần ghi, không đụng `updated_at`, và lỗi ghi không làm hỏng request.
 */
#[Group('last-seen')]
class LastSeenTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'seller'): User
    {
        return User::factory()->create(['role' => $role, 'project' => 'happy', 'is_active' => true]);
    }

    private function lastSeen(User $user): ?string
    {
        return DB::table('users')->where('id', $user->id)->value('last_seen_at');
    }

    public function test_request_da_dang_nhap_ghi_moc_truy_cap(): void
    {
        $user = $this->user();
        $this->assertNull($this->lastSeen($user), 'tài khoản mới chưa có mốc nào');

        $this->actingAs($user)->getJson('/api/me')->assertOk();

        $this->assertNotNull($this->lastSeen($user));
    }

    /** Mỗi request một lần UPDATE là không chấp nhận được — phải chặn bớt. */
    public function test_nhieu_request_lien_tiep_chi_ghi_mot_lan(): void
    {
        $user = $this->user();

        $this->actingAs($user)->getJson('/api/me')->assertOk();
        $first = $this->lastSeen($user);

        Carbon::setTestNow(now()->addMinutes(2));
        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($user)->getJson('/api/me')->assertOk();
        }

        $this->assertSame($first, $this->lastSeen($user), 'trong cửa sổ chặn thì không được ghi lại');
        Carbon::setTestNow();
    }

    public function test_qua_cua_so_chan_thi_ghi_lai(): void
    {
        $user = $this->user();
        $this->actingAs($user)->getJson('/api/me')->assertOk();
        $first = $this->lastSeen($user);

        Carbon::setTestNow(now()->addMinutes(6));
        $this->actingAs($user)->getJson('/api/me')->assertOk();

        $this->assertNotSame($first, $this->lastSeen($user));
        Carbon::setTestNow();
    }

    /**
     * Ghi mốc KHÔNG được coi là "sửa tài khoản": nếu đụng `updated_at` thì mỗi
     * lần người dùng mở trang là một lần bản ghi bị đánh dấu thay đổi.
     */
    public function test_khong_dung_toi_updated_at(): void
    {
        $user = $this->user();
        $before = DB::table('users')->where('id', $user->id)->value('updated_at');

        Carbon::setTestNow(now()->addMinutes(10));
        $this->actingAs($user)->getJson('/api/me')->assertOk();

        $this->assertSame($before, DB::table('users')->where('id', $user->id)->value('updated_at'));
        Carbon::setTestNow();
    }

    /** Người dùng khác nhau chặn độc lập, không dùng chung một khoá. */
    public function test_moi_nguoi_mot_cua_so_chan_rieng(): void
    {
        $a = $this->user();
        $b = $this->user();

        $this->actingAs($a)->getJson('/api/me')->assertOk();
        $this->actingAs($b)->getJson('/api/me')->assertOk();

        $this->assertNotNull($this->lastSeen($a));
        $this->assertNotNull($this->lastSeen($b));
    }

    /** Request chưa đăng nhập vẫn trả 401 như cũ, không nổ ở middleware. */
    public function test_request_chua_dang_nhap_khong_bi_anh_huong(): void
    {
        $this->getJson('/api/me')->assertStatus(401);

        $this->assertSame(0, DB::table('users')->whereNotNull('last_seen_at')->count());
    }

    /** Request bị chặn quyền vẫn tính là một lần truy cập — họ CÓ vào hệ thống. */
    public function test_request_bi_tu_choi_quyen_van_tinh_la_truy_cap(): void
    {
        $seller = $this->user('seller');

        $this->actingAs($seller)->getJson('/api/admin/users')->assertStatus(403);

        $this->assertNotNull($this->lastSeen($seller));
    }

    // ── Payload cho màn hình Quản Lý Nhân Sự ────────────────────────────────

    public function test_danh_sach_nhan_su_tra_moc_truy_cap(): void
    {
        $admin = $this->user('admin');
        $seller = $this->user('seller');
        DB::table('users')->where('id', $seller->id)->update(['last_seen_at' => '2026-08-10 03:00:00']);

        $users = $this->actingAs($admin)->getJson('/api/admin/users')->assertOk()->json('users');

        $row = collect($users)->firstWhere('id', $seller->id);
        $this->assertArrayHasKey('last_seen_at', $row);
        $this->assertStringStartsWith('2026-08-10', $row['last_seen_at']);
    }

    /** Chưa truy cập lần nào thì trả null — UI hiện "Chưa truy cập". */
    public function test_chua_truy_cap_thi_tra_null(): void
    {
        $admin = $this->user('admin');
        $moi   = User::factory()->create(['role' => 'pd', 'is_active' => true]);

        $users = $this->actingAs($admin)->getJson('/api/admin/users')->assertOk()->json('users');

        $this->assertNull(collect($users)->firstWhere('id', $moi->id)['last_seen_at']);
    }
}
