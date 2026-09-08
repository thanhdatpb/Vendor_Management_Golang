<?php

namespace Tests\Feature;

use App\Jobs\SendNotificationEmail;
use App\Mail\NotificationMail;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Đường dây mail đầy đủ: tạo Notification → Notification::booted() đẩy job
 * SendNotificationEmail vào hàng đợi → job hỏi NotificationEmailPolicy → gửi
 * (hoặc bỏ qua) qua NotificationMail, ghi lại email_status.
 *
 * Chuông web (broadcast Pusher) đã có test riêng (NotificationRealtimeTest) —
 * bộ này chỉ phủ nhánh email mới thêm.
 */
class NotificationEmailDispatchTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role'      => $role,
            'is_active' => true,
        ], $overrides));
    }

    public function test_tao_notification_day_job_gui_email_vao_hang_doi(): void
    {
        Queue::fake();
        $seller = $this->makeUser('seller');

        $notification = Notification::create([
            'user_id' => $seller->id,
            'type'    => 'approved',
            'title'   => '✅ Request đã được duyệt',
            'body'    => 'Request "Ceramic Mug 11oz" đã được Admin phê duyệt.',
            'is_read' => false,
            'data'    => json_encode(['product_id' => 1, 'product_type' => 'Ceramic Mug 11oz']),
        ]);

        Queue::assertPushed(
            SendNotificationEmail::class,
            fn (SendNotificationEmail $job) => $job->notificationId === $notification->id
        );
    }

    public function test_loai_khong_email_duoc_job_ghi_skipped_khong_gui_mail(): void
    {
        Mail::fake();
        Queue::fake(); // cô lập: chỉ chạy job đúng 1 lần (thủ công), không lẫn với auto-dispatch của booted()
        $seller = $this->makeUser('seller');

        $notification = Notification::create([
            'user_id' => $seller->id,
            'type'    => 'feedback',
            'title'   => '💬 Có phản hồi mới từ Staff B',
            'body'    => 'Request "Ceramic Mug 11oz": nội dung phản hồi.',
            'is_read' => false,
            'data'    => json_encode(['product_id' => 1]),
        ]);

        (new SendNotificationEmail($notification->id))->handle();

        Mail::assertNothingSent();
        $notification->refresh();
        $this->assertSame('skipped', $notification->email_status);
        $this->assertSame('type_not_emailable', $notification->email_error);
    }

    public function test_job_gui_thanh_cong_ghi_sent_va_dung_dia_chi(): void
    {
        Mail::fake();
        Queue::fake(); // cô lập: chỉ chạy job đúng 1 lần (thủ công), không lẫn với auto-dispatch của booted()
        $seller = $this->makeUser('seller', ['email' => 'ngoc.anh@test.com']);

        $notification = Notification::create([
            'user_id' => $seller->id,
            'type'    => 'approved',
            'title'   => '✅ Request đã được duyệt',
            'body'    => 'Request "Ceramic Mug 11oz" đã được Admin phê duyệt.',
            'is_read' => false,
            'data'    => json_encode(['product_id' => 1, 'product_type' => 'Ceramic Mug 11oz']),
        ]);

        (new SendNotificationEmail($notification->id))->handle();

        Mail::assertSent(
            NotificationMail::class,
            fn (NotificationMail $mail) => $mail->hasTo('ngoc.anh@test.com')
                && $mail->notification->id === $notification->id
        );

        $notification->refresh();
        $this->assertSame('sent', $notification->email_status);
        $this->assertNotNull($notification->email_sent_at);
        $this->assertNull($notification->email_error);
    }

    public function test_role_khong_hop_le_duoc_job_ghi_role_not_allowed(): void
    {
        Mail::fake();
        Queue::fake(); // cô lập: chỉ chạy job đúng 1 lần (thủ công), không lẫn với auto-dispatch của booted()
        $csf = $this->makeUser('csf');

        $notification = Notification::create([
            'user_id' => $csf->id,
            'type'    => 'approved', // 'approved' chỉ dành cho seller
            'title'   => '✅ Request đã được duyệt',
            'body'    => 'Request "Ceramic Mug 11oz" đã được Admin phê duyệt.',
            'is_read' => false,
            'data'    => json_encode(['product_id' => 1]),
        ]);

        (new SendNotificationEmail($notification->id))->handle();

        Mail::assertNothingSent();
        $this->assertSame('role_not_allowed', $notification->fresh()->email_error);
    }

    public function test_ban_ghi_bi_xoa_truoc_khi_job_chay_thi_khong_lam_gi(): void
    {
        Mail::fake();
        // Phải fake cả Queue: nếu không, Notification::booted() tự chạy job
        // NGAY LÚC create() (QUEUE_CONNECTION=sync trong test) — mail đã gửi
        // xong trước khi kịp xoá bản ghi, làm mất hết ý nghĩa của test này.
        Queue::fake();

        $seller = $this->makeUser('seller');
        $notification = Notification::create([
            'user_id' => $seller->id,
            'type'    => 'approved',
            'title'   => 'X',
            'body'    => 'Y',
            'is_read' => false,
        ]);
        $id = $notification->id;
        $notification->delete();

        // Không được ném lỗi — bản ghi không còn thì không còn gì để gửi.
        (new SendNotificationEmail($id))->handle();

        Mail::assertNothingSent();
    }

    public function test_subject_ghep_dung_dinh_dang_va_bo_emoji_dau_cau(): void
    {
        $seller = $this->makeUser('seller');
        $notification = Notification::create([
            'user_id' => $seller->id,
            'type'    => 'approved',
            'title'   => '✅ Request đã được duyệt',
            'body'    => 'Request "Ceramic Mug 11oz" đã được Admin phê duyệt.',
            'is_read' => false,
            'data'    => json_encode(['product_id' => 1, 'product_type' => 'Ceramic Mug 11oz']),
        ]);

        $mail = (new NotificationMail($notification))->build();

        $this->assertSame('[VendorHub] Request đã được duyệt — Ceramic Mug 11oz', $mail->subject);
    }

    public function test_button_url_tro_dung_man_hinh_va_gan_product_id(): void
    {
        $seller = $this->makeUser('seller');
        $notification = Notification::create([
            'user_id' => $seller->id,
            'type'    => 'approved',
            'title'   => '✅ Request đã được duyệt',
            'body'    => 'Request "Ceramic Mug 11oz" đã được Admin phê duyệt.',
            'is_read' => false,
            'data'    => json_encode(['product_id' => 482, 'product_type' => 'Ceramic Mug 11oz']),
        ]);

        $html = (new NotificationMail($notification))->render();

        $this->assertStringContainsString('/seller/products?product=482', $html);
    }

    public function test_library_updated_button_dung_tham_so_file_khong_phai_product(): void
    {
        $seller = $this->makeUser('seller');
        $notification = Notification::create([
            'user_id' => $seller->id,
            'type'    => 'library_updated',
            'title'   => '📚 File "P.HAPPY.xlsx" vừa được cập nhật',
            'body'    => 'Vendor vừa cập nhật 1 dòng thông tin phôi trong file này.',
            'is_read' => false,
            'data'    => json_encode(['filename' => 'P.HAPPY.xlsx', 'changes_summary' => '1 dòng cập nhật']),
        ]);

        $html = (new NotificationMail($notification))->render();

        $this->assertStringContainsString('/seller/vendors?file=P.HAPPY.xlsx', $html);
    }

    public function test_noi_dung_nguoi_dung_go_duoc_escape_khong_thuc_thi_html(): void
    {
        $seller = $this->makeUser('seller');
        $notification = Notification::create([
            'user_id' => $seller->id,
            'type'    => 'feedback',
            'title'   => '💬 Có phản hồi mới',
            'body'    => "<script>alert('x')</script> nội dung phản hồi",
            'is_read' => false,
            'data'    => json_encode(['product_id' => 1]),
        ]);

        $html = (new NotificationMail($notification))->render();

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
    }
}
