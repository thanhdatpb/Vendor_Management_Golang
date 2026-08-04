<?php

namespace Tests\Feature;

use App\Models\News;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Vendor tạo thông báo ở màn Quản Lý Thông Báo rồi bấm Gửi → Admin & Seller phải
 * thực sự nhận được ở chuông, và thông báo đó khoá lại (không sửa/xoá/gửi lại).
 *
 * Trước đây việc fan-out chạy ở client qua POST /api/notifications — route không
 * tồn tại nên request 404 rồi rơi vào fallback localStorage của chính máy Vendor,
 * người nhận ở máy khác không bao giờ thấy gì mà UI vẫn báo "Đã gửi". Bộ test này
 * chốt lại hành vi đúng ở tầng server để lỗi đó không tái diễn.
 */
class NewsSendTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role, string $suffix = ''): User
    {
        return User::factory()->create([
            'role'      => $role,
            'name'      => "{$role}{$suffix}",
            'email'     => "{$role}{$suffix}@test.com",
            'password'  => bcrypt('secret'),
            'is_active' => true,
        ]);
    }

    private function makeNews(array $overrides = []): News
    {
        return News::create(array_merge([
            'title'   => 'Thông báo tuần 1',
            'message' => 'Nội dung thông báo tuần 1',
            'target'  => 'both',
        ], $overrides));
    }

    /** Migration phải tạo được cột sent_at — chính cột bị thiếu gây lỗi 42S22. */
    public function test_migration_tao_cot_sent_at(): void
    {
        $this->assertTrue(Schema::hasColumn('news', 'sent_at'));
    }

    /** Tạo mới là bản nháp: chưa gửi cho ai, chưa sinh notification nào. */
    public function test_tao_thong_bao_la_ban_nhap_chua_gui(): void
    {
        $vendor = $this->makeUser('vendor');

        $res = $this->actingAs($vendor)->postJson('/api/news', [
            'title'   => 'Tin nháp',
            'message' => 'Chưa gửi',
        ]);

        $res->assertStatus(201);
        $this->assertNull($res->json('sent_at'));
        $this->assertSame(0, Notification::count());
    }

    /** Bấm Gửi → mọi tài khoản Admin & Seller nhận notification, news bị đóng dấu. */
    public function test_gui_tao_notification_cho_moi_admin_va_seller(): void
    {
        $vendor  = $this->makeUser('vendor');
        $admin   = $this->makeUser('admin');
        $seller1 = $this->makeUser('seller', '1');
        $seller2 = $this->makeUser('seller', '2');
        $csf     = $this->makeUser('csf');   // không nằm trong danh sách nhận
        $news    = $this->makeNews();

        $res = $this->actingAs($vendor)->postJson("/api/news/{$news->id}/send");

        $res->assertStatus(200);
        $this->assertNotNull($res->json('sent_at'), 'response phải trả sent_at đã đóng dấu');

        // Đúng 3 người nhận: 1 admin + 2 seller. Vendor tự gửi và CSF đều không nhận.
        $this->assertSame(3, Notification::where('type', 'news')->count());
        foreach ([$admin, $seller1, $seller2] as $recipient) {
            $this->assertDatabaseHas('notifications', [
                'user_id' => $recipient->id,
                'type'    => 'news',
                'title'   => 'Thông báo tuần 1',
                'is_read' => false,
            ]);
        }
        $this->assertDatabaseMissing('notifications', ['user_id' => $csf->id]);
        $this->assertDatabaseMissing('notifications', ['user_id' => $vendor->id]);

        $this->assertNotNull($news->fresh()->sent_at);
    }

    /** Người nhận đọc được tin qua GET /api/notifications (đường mà chuông dùng). */
    public function test_seller_doc_duoc_tin_qua_api_notifications(): void
    {
        $vendor = $this->makeUser('vendor');
        $seller = $this->makeUser('seller');
        $news   = $this->makeNews(['title' => 'Tin cho seller', 'message' => 'Nội dung']);

        $this->actingAs($vendor)->postJson("/api/news/{$news->id}/send")->assertStatus(200);

        $res = $this->actingAs($seller)->getJson('/api/notifications');

        $res->assertStatus(200);
        $newsItems = collect($res->json('data'))->where('type', 'news')->values();
        $this->assertCount(1, $newsItems);
        $this->assertSame('Tin cho seller', $newsItems[0]['title']);
        $this->assertSame('Nội dung', $newsItems[0]['body']);
        $this->assertSame(1, $res->json('unread'));
    }

    /** Gửi lần hai bị chặn ở server — không phát trùng cho người nhận. */
    public function test_khong_gui_lai_duoc_lan_hai(): void
    {
        $vendor = $this->makeUser('vendor');
        $this->makeUser('admin');
        $news = $this->makeNews();

        $this->actingAs($vendor)->postJson("/api/news/{$news->id}/send")->assertStatus(200);
        $again = $this->actingAs($vendor)->postJson("/api/news/{$news->id}/send");

        $again->assertStatus(409);
        $this->assertSame(1, Notification::where('type', 'news')->count());
    }

    /** Đã gửi thì không sửa được — bên nhận đã cầm bản cũ. */
    public function test_khong_sua_duoc_sau_khi_gui(): void
    {
        $vendor = $this->makeUser('vendor');
        $this->makeUser('admin');
        $news = $this->makeNews();

        $this->actingAs($vendor)->postJson("/api/news/{$news->id}/send")->assertStatus(200);

        $res = $this->actingAs($vendor)->putJson("/api/news/{$news->id}", [
            'title'   => 'Đổi tiêu đề',
            'message' => 'Đổi nội dung',
        ]);

        $res->assertStatus(409);
        $this->assertSame('Thông báo tuần 1', $news->fresh()->title);
    }

    /** Đã gửi thì không xoá được. */
    public function test_khong_xoa_duoc_sau_khi_gui(): void
    {
        $vendor = $this->makeUser('vendor');
        $this->makeUser('admin');
        $news = $this->makeNews();

        $this->actingAs($vendor)->postJson("/api/news/{$news->id}/send")->assertStatus(200);

        $this->actingAs($vendor)->deleteJson("/api/news/{$news->id}")->assertStatus(409);
        $this->assertDatabaseHas('news', ['id' => $news->id]);
    }

    /** Bản nháp thì vẫn sửa/xoá bình thường. */
    public function test_ban_nhap_van_sua_va_xoa_duoc(): void
    {
        $vendor = $this->makeUser('vendor');
        $news   = $this->makeNews();

        $this->actingAs($vendor)->putJson("/api/news/{$news->id}", [
            'title'   => 'Tiêu đề mới',
            'message' => 'Nội dung mới',
        ])->assertStatus(200);
        $this->assertSame('Tiêu đề mới', $news->fresh()->title);

        $this->actingAs($vendor)->deleteJson("/api/news/{$news->id}")->assertStatus(200);
        $this->assertDatabaseMissing('news', ['id' => $news->id]);
    }

    /**
     * Mô phỏng đúng sự cố production 2026-08-04: code đã deploy nhưng server chưa
     * chạy `php artisan migrate` nên thiếu cột news.sent_at.
     *
     * Phải trả 503 kèm hướng dẫn, KHÔNG được để lọt chuỗi SQL gốc của PDO ra ngoài —
     * message đó có cả host, port và tên database, mà UI thì đổ thẳng vào toast của
     * người dùng cuối.
     */
    public function test_thieu_cot_sent_at_bao_loi_ro_rang_khong_lo_sql(): void
    {
        $vendor = $this->makeUser('vendor');
        $this->makeUser('admin');
        $news = $this->makeNews();

        Schema::table('news', function ($table) {
            $table->dropColumn('sent_at');
        });

        $res = $this->actingAs($vendor)->postJson("/api/news/{$news->id}/send");

        $res->assertStatus(503);
        $message = $res->json('message');
        $this->assertStringContainsString('php artisan migrate', $message);
        $this->assertStringNotContainsString('SQLSTATE', $message);
        $this->assertStringNotContainsString('update `news`', $message);
        $this->assertSame(0, Notification::count(), 'không được phát notification khi chưa ghi được sent_at');
    }

    /**
     * Nếu fan-out (NotificationService::sendToRole) ném lỗi SAU KHI sent_at đã
     * commit, phải nhả lại sent_at về NULL — nếu không, tin bị khoá VĨNH VIỄN ở
     * trạng thái "đã gửi" dù chưa ai thực sự nhận được gì (send/update/destroy sau
     * đó đều 409, không còn cách nào gửi lại ngoài sửa thẳng DB).
     *
     * Mô phỏng bằng cách xoá cột notifications.data — cột NotificationService
     * luôn ghi vào mỗi lần tạo notification.
     */
    public function test_fan_out_loi_thi_nha_lai_sent_at_de_gui_lai_duoc(): void
    {
        $vendor = $this->makeUser('vendor');
        $this->makeUser('admin');
        $news = $this->makeNews();

        Schema::table('notifications', function ($table) {
            $table->dropColumn('data');
        });

        $res = $this->actingAs($vendor)->postJson("/api/news/{$news->id}/send");

        $res->assertStatus(500);
        $this->assertStringNotContainsString('SQLSTATE', (string) $res->json('message'));
        $this->assertNull($news->fresh()->sent_at, 'sent_at phải được nhả lại NULL để gửi lại được');
    }

    /** Chỉ Vendor được gửi — Seller/Admin bấm vào endpoint này phải bị chặn. */
    public function test_chi_vendor_duoc_gui(): void
    {
        $seller = $this->makeUser('seller');
        $admin  = $this->makeUser('admin');
        $news   = $this->makeNews();

        $this->actingAs($seller)->postJson("/api/news/{$news->id}/send")->assertStatus(403);
        $this->actingAs($admin)->postJson("/api/news/{$news->id}/send")->assertStatus(403);
        $this->assertNull($news->fresh()->sent_at);
    }
}
