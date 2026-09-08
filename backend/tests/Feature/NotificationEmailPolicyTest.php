<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\NotificationEmailSetting;
use App\Models\User;
use App\Services\NotificationEmailPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

/**
 * NotificationEmailPolicy là MỘT CHỖ DUY NHẤT quyết định một Notification có
 * được gửi mail hay không — 4 lớp kiểm tra theo đúng thứ tự kế hoạch đã duyệt:
 * người nhận hợp lệ → role allow-list → ma trận cài đặt → chống trùng/trần giờ.
 */
class NotificationEmailPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $role, array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role'      => $role,
            'is_active' => true,
        ], $overrides));
    }

    private function makeNotification(User $user, string $type, array $data = []): Notification
    {
        return Notification::create([
            'user_id' => $user->id,
            'type'    => $type,
            'title'   => 'Tiêu đề test',
            'body'    => 'Nội dung test',
            'is_read' => false,
            'data'    => $data ? json_encode($data) : null,
        ]);
    }

    public function test_loai_khong_co_trong_config_bi_bo_qua(): void
    {
        $user = $this->makeUser('seller');
        foreach (['news', 'feedback', 'pending', 'khong_ton_tai'] as $type) {
            $n = $this->makeNotification($user, $type);
            $this->assertSame('type_not_emailable', NotificationEmailPolicy::reasonToSkip($n));
        }
    }

    public function test_loai_da_cau_hinh_va_role_hop_le_thi_duoc_gui(): void
    {
        $seller = $this->makeUser('seller');
        $n = $this->makeNotification($seller, 'approved', ['product_id' => 1]);

        $this->assertNull(NotificationEmailPolicy::reasonToSkip($n));
    }

    public function test_role_khong_nam_trong_allow_list_cua_loai_bi_chan(): void
    {
        // 'approved' chỉ dành cho seller (config/notification_mail.php) — một
        // notification kiểu 'approved' lỡ tạo cho csf (vd do lỗ hổng phân quyền
        // khác) phải bị chặn ở đây, độc lập với ma trận cài đặt.
        $csf = $this->makeUser('csf');
        $n = $this->makeNotification($csf, 'approved', ['product_id' => 1]);

        $this->assertSame('role_not_allowed', NotificationEmailPolicy::reasonToSkip($n));
    }

    public function test_role_legacy_staff_a_duoc_quy_ve_seller(): void
    {
        $legacySeller = $this->makeUser('staff_a');
        $n = $this->makeNotification($legacySeller, 'approved', ['product_id' => 1]);

        $this->assertNull(NotificationEmailPolicy::reasonToSkip($n), 'staff_a phải được coi như seller');
    }

    public function test_user_bi_khoa_thi_khong_gui(): void
    {
        $seller = $this->makeUser('seller', ['is_active' => false]);
        $n = $this->makeNotification($seller, 'approved', ['product_id' => 1]);

        $this->assertSame('user_inactive', NotificationEmailPolicy::reasonToSkip($n));
    }

    public function test_email_rong_thi_khong_gui(): void
    {
        $seller = $this->makeUser('seller', ['email' => '']);
        $n = $this->makeNotification($seller, 'approved', ['product_id' => 1]);

        $this->assertSame('invalid_email', NotificationEmailPolicy::reasonToSkip($n));
    }

    public function test_admin_tat_o_ma_tran_thi_khong_gui(): void
    {
        $seller = $this->makeUser('seller');
        NotificationEmailSetting::updateOrCreate(
            ['role' => 'seller', 'type' => 'approved'],
            ['enabled' => false]
        );

        $n = $this->makeNotification($seller, 'approved', ['product_id' => 1]);

        $this->assertSame('disabled_by_admin', NotificationEmailPolicy::reasonToSkip($n));
    }

    public function test_chua_co_dong_cai_dat_thi_mac_dinh_bat(): void
    {
        // Không tạo dòng NotificationEmailSetting nào — mọi cặp reachable coi
        // như bật, vì hàng rào role allow-list đã ngăn các cặp không reachable.
        $seller = $this->makeUser('seller');
        $n = $this->makeNotification($seller, 'approved', ['product_id' => 1]);

        $this->assertNull(NotificationEmailPolicy::reasonToSkip($n));
    }

    public function test_hai_tai_khoan_cung_email_cung_product_id_trong_5_phut_chi_gui_1(): void
    {
        $email = 'shared@test.com';
        $sellerA = $this->makeUser('seller', ['email' => $email]);
        $sellerB = $this->makeUser('seller', ['email' => $email]);

        $first  = $this->makeNotification($sellerA, 'approved', ['product_id' => 42]);
        $second = $this->makeNotification($sellerB, 'approved', ['product_id' => 42]);

        // Giả lập: notification đầu đã được job gửi thành công.
        $first->forceFill(['email_status' => 'sent'])->save();

        $this->assertSame('duplicate', NotificationEmailPolicy::reasonToSkip($second));
    }

    public function test_cung_email_nhung_khac_product_id_khong_bi_coi_la_trung(): void
    {
        $email = 'shared2@test.com';
        $sellerA = $this->makeUser('seller', ['email' => $email]);
        $sellerB = $this->makeUser('seller', ['email' => $email]);

        $first  = $this->makeNotification($sellerA, 'approved', ['product_id' => 1]);
        $second = $this->makeNotification($sellerB, 'approved', ['product_id' => 2]);
        $first->forceFill(['email_status' => 'sent'])->save();

        $this->assertNull(NotificationEmailPolicy::reasonToSkip($second));
    }

    public function test_library_updated_dung_filename_lam_khoa_chong_trung(): void
    {
        $email = 'pdshared@test.com';
        $pdA = $this->makeUser('pd', ['email' => $email, 'pd_projects' => ['Happy Project']]);
        $pdB = $this->makeUser('pd', ['email' => $email, 'pd_projects' => ['Global Project']]);

        $first  = $this->makeNotification($pdA, 'library_updated', ['filename' => 'P.HAPPY.xlsx']);
        $second = $this->makeNotification($pdB, 'library_updated', ['filename' => 'P.HAPPY.xlsx']);
        $first->forceFill(['email_status' => 'sent'])->save();

        $this->assertSame('duplicate', NotificationEmailPolicy::reasonToSkip($second));
    }

    public function test_vuot_tran_gio_thi_bi_chan(): void
    {
        Config::set('notification_mail.hourly_cap', 1);

        $seller1 = $this->makeUser('seller');
        $seller2 = $this->makeUser('seller');

        $already = $this->makeNotification($seller1, 'approved', ['product_id' => 1]);
        $already->forceFill(['email_status' => 'sent', 'email_sent_at' => now()])->save();

        $next = $this->makeNotification($seller2, 'approved', ['product_id' => 2]);

        $this->assertSame('hourly_cap', NotificationEmailPolicy::reasonToSkip($next));
    }

    public function test_tran_0_nghia_la_khong_gioi_han(): void
    {
        Config::set('notification_mail.hourly_cap', 0);

        $seller1 = $this->makeUser('seller');
        $seller2 = $this->makeUser('seller');

        $already = $this->makeNotification($seller1, 'approved', ['product_id' => 1]);
        $already->forceFill(['email_status' => 'sent', 'email_sent_at' => now()])->save();

        $next = $this->makeNotification($seller2, 'approved', ['product_id' => 2]);

        $this->assertNull(NotificationEmailPolicy::reasonToSkip($next));
    }

    public function test_canonical_role_gop_ten_legacy(): void
    {
        $this->assertSame('seller', NotificationEmailPolicy::canonicalRole('staff_a'));
        $this->assertSame('vendor', NotificationEmailPolicy::canonicalRole('staff_b'));
        $this->assertSame('admin', NotificationEmailPolicy::canonicalRole('admin'));
        $this->assertSame('', NotificationEmailPolicy::canonicalRole(null));
    }
}
