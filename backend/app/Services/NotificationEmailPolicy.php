<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\NotificationEmailSetting;

/**
 * Quyết định MỘT CHỖ DUY NHẤT: một Notification có được gửi mail hay không.
 *
 * Bốn lớp kiểm tra, theo đúng thứ tự trong kế hoạch đã duyệt:
 *   1. Người nhận — còn tồn tại, đang active, có email hợp lệ.
 *   2. Role allow-list của loại đó (config/notification_mail.php) — hàng rào
 *      cứng, độc lập với ma trận cài đặt.
 *   3. Ma trận cài đặt (notification_email_settings) — quyền quyết định của
 *      Admin, mặc định bật nếu chưa có dòng (mọi cặp reachable đã được seed).
 *   4. Chống trùng (5 phút, riêng library_updated là 15 phút) + trần số
 *      lượng/giờ.
 */
class NotificationEmailPolicy
{
    /**
     * Chuẩn hoá role: gộp tên legacy (staff_a/staff_b) về tên hiện hành
     * (seller/vendor) — cùng nghĩa nghiệp vụ, khác chỉ vì lịch sử đổi tên.
     */
    public static function canonicalRole(?string $role): string
    {
        $normalized = strtolower(trim((string) $role));

        return match ($normalized) {
            'staff_a', 'staffa' => 'seller',
            'staff_b', 'staffb' => 'vendor',
            default => $normalized,
        };
    }

    /**
     * Trả về null nếu được phép gửi mail; trả về mã lý do (lưu vào
     * notifications.email_error) nếu phải bỏ qua.
     */
    public static function reasonToSkip(Notification $notification): ?string
    {
        $type = (string) $notification->type;
        $typeConfig = config("notification_mail.types.$type");

        if ($typeConfig === null) {
            // news / feedback / pending — cố tình không có trong config, chỉ
            // chạy trên chuông web.
            return 'type_not_emailable';
        }

        $user = $notification->user;
        if (!$user) {
            return 'user_missing';
        }
        if (!$user->is_active) {
            return 'user_inactive';
        }

        $email = trim((string) $user->email);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return 'invalid_email';
        }

        $role = self::canonicalRole($user->role);
        if (!in_array($role, $typeConfig['roles'] ?? [], true)) {
            return 'role_not_allowed';
        }

        $setting = NotificationEmailSetting::where('role', $role)->where('type', $type)->first();
        if ($setting && !$setting->enabled) {
            return 'disabled_by_admin';
        }

        if (self::isDuplicate($notification, $email)) {
            return 'duplicate';
        }

        if (self::hourlyCapExceeded()) {
            return 'hourly_cap';
        }

        return null;
    }

    /** Đọc cột `data` (lưu dạng chuỗi JSON) thành mảng, an toàn với mọi trạng thái. */
    public static function decodedData(Notification $notification): array
    {
        $raw = $notification->data;
        if (is_array($raw)) {
            return $raw;
        }
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }

    /**
     * Khoá để nhận biết "cùng một việc": product_id cho mọi loại thường,
     * filename cho library_updated (mỗi file cập nhật là một khoá riêng).
     */
    private static function dedupeKey(Notification $notification): ?string
    {
        $data = self::decodedData($notification);
        if ($notification->type === 'library_updated') {
            return isset($data['filename']) ? (string) $data['filename'] : null;
        }
        return isset($data['product_id']) ? (string) $data['product_id'] : null;
    }

    /**
     * Đã gửi mail cho CÙNG một địa chỉ, CÙNG loại, CÙNG khoá nội dung trong
     * cửa sổ gần đây chưa — bắt trường hợp một người có nhiều dòng `users`
     * (khác role/project, cùng email) đều được tạo notification cho cùng một
     * sự kiện.
     */
    private static function isDuplicate(Notification $notification, string $email): bool
    {
        $key = self::dedupeKey($notification);
        if ($key === null) {
            // Không có khoá để so — thà gửi thừa còn hơn chặn nhầm.
            return false;
        }

        $windowMinutes = $notification->type === 'library_updated' ? 15 : 5;

        $recentSent = Notification::query()
            ->where('id', '!=', $notification->id)
            ->where('type', $notification->type)
            ->where('email_status', 'sent')
            ->where('created_at', '>=', now()->subMinutes($windowMinutes))
            ->whereHas('user', fn ($q) => $q->where('email', $email))
            ->get();

        foreach ($recentSent as $candidate) {
            if (self::dedupeKey($candidate) === $key) {
                return true;
            }
        }

        return false;
    }

    /** Trần số mail gửi được trong 1 giờ — bảo vệ quota SMTP. 0/âm = không giới hạn. */
    private static function hourlyCapExceeded(): bool
    {
        $cap = (int) config('notification_mail.hourly_cap', 300);
        if ($cap <= 0) {
            return false;
        }

        $sentLastHour = Notification::where('email_status', 'sent')
            ->where('email_sent_at', '>=', now()->subHour())
            ->count();

        return $sentLastHour >= $cap;
    }
}
