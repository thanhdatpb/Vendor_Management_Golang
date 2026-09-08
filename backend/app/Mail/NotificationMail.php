<?php

namespace App\Mail;

use App\Models\Notification;
use App\Services\NotificationEmailPolicy;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Một khung thư DUY NHẤT cho mọi loại thông báo — phần thay đổi chỉ là nhãn
 * loại, tiêu đề, đoạn nội dung, bảng meta và nút hành động, tất cả lấy từ
 * config/notification_mail.php + cột `data` của chính Notification. Chuông
 * web và email vì vậy luôn nói cùng một câu (title/body dùng chung).
 */
class NotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Notification $notification)
    {
    }

    public function build(): self
    {
        $type = (string) $this->notification->type;
        $typeConfig = config("notification_mail.types.$type", []);
        $data = NotificationEmailPolicy::decodedData($this->notification);
        $role = NotificationEmailPolicy::canonicalRole($this->notification->user?->role);

        $title = $this->stripLeadingEmoji((string) $this->notification->title);
        $subjectSuffix = $data['product_type'] ?? $data['project'] ?? $data['filename'] ?? null;
        // Bỏ hậu tố nếu tiêu đề đã chứa sẵn nó — vd library_updated có tiêu đề
        // 'File "X" vừa được cập nhật', ghép thêm '— X' thành lặp tên file 2 lần.
        if ($subjectSuffix !== null && str_contains($title, (string) $subjectSuffix)) {
            $subjectSuffix = null;
        }
        $subject = '[VendorHub] ' . $title . ($subjectSuffix ? ' — ' . $subjectSuffix : '');

        $createdAt = $this->notification->created_at
            ? Carbon::parse($this->notification->created_at)->timezone('Asia/Ho_Chi_Minh')
            : now('Asia/Ho_Chi_Minh');

        return $this->subject($subject)
            ->view('emails.notification')
            ->text('emails.notification-text')
            ->with([
                'icon'        => $typeConfig['icon'] ?? '📢',
                'label'       => $typeConfig['label'] ?? 'Thông báo',
                'title'       => $title,
                'body'        => Str::limit((string) $this->notification->body, 500),
                'meta'        => $this->buildMeta($typeConfig['meta'] ?? [], $data, $createdAt),
                'buttonLabel' => $typeConfig['button'] ?? 'Mở hệ thống',
                'buttonUrl'   => $this->buildButtonUrl($type, $role, $data),
            ]);
    }

    /** Bỏ emoji + khoảng trắng ở đầu chuỗi — Subject không nên mở đầu bằng emoji. */
    private function stripLeadingEmoji(string $text): string
    {
        return trim(preg_replace(
            '/^[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2190}-\x{21FF}\x{FE0F}\x{200D}]+\s*/u',
            '',
            $text
        ) ?? $text);
    }

    /**
     * Bảng meta hiển thị trong thư, theo đúng thứ tự khai trong config. Bỏ
     * qua khoá không có giá trị (vd `deadline_date` chỉ tồn tại ở loại
     * `deadline_updated`) — không hiện dòng trống.
     *
     * @param  array<string,string>  $labelMap  khoá trong `data` → nhãn hiển thị
     * @return array<string,string>
     */
    private function buildMeta(array $labelMap, array $data, Carbon $createdAt): array
    {
        $meta = [];
        foreach ($labelMap as $key => $label) {
            if (!empty($data[$key])) {
                $meta[$label] = (string) $data[$key];
            }
        }
        $meta['Thời gian'] = $createdAt->format('d/m/Y H:i') . ' (giờ VN)';
        return $meta;
    }

    private function buildButtonUrl(string $type, string $role, array $data): string
    {
        $base = rtrim((string) env('FRONTEND_URL', 'https://vendorhub.viehana.com'), '/');
        $path = config("notification_mail.routes.$type.$role");
        if (!$path) {
            return $base;
        }

        $paramName = config("notification_mail.query_param.$type")
            ?? config('notification_mail.default_query_param', 'product');
        $paramValue = $type === 'library_updated'
            ? ($data['filename'] ?? null)
            : ($data['product_id'] ?? null);

        if ($paramValue === null || $paramValue === '') {
            return $base . $path;
        }

        return $base . $path . '?' . http_build_query([$paramName => $paramValue]);
    }
}
