<?php

namespace App\Jobs;

use App\Mail\NotificationMail;
use App\Models\Notification;
use App\Services\NotificationEmailPolicy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Gửi email mirror cho một Notification, chạy nền qua hàng đợi.
 *
 * `$afterCommit = true` là bắt buộc: một số nơi tạo Notification bên trong
 * DB::transaction (vd News::send chốt sent_at rồi mới fan-out) — dispatch
 * trước khi transaction commit thì job có thể chạy trước khi bản ghi thực sự
 * tồn tại trong DB (đặc biệt với QUEUE_CONNECTION=sync, job chạy NGAY trong
 * cùng request, trước cả khi transaction cha kết thúc).
 *
 * Lỗi ở đây KHÔNG được phép làm hỏng nghiệp vụ chính đã tạo ra Notification —
 * đúng tinh thần try/catch quanh broadcast Pusher trong Notification::booted().
 */
class SendNotificationEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;

    /** @var array<int,int> Giây chờ trước mỗi lần thử lại. */
    public $backoff = [60, 300, 900];

    public function __construct(public int $notificationId)
    {
        // Không khai property riêng: Illuminate\Bus\Queueable đã tự khai
        // `public $afterCommit` (không kiểu, không mặc định) — khai lại với
        // kiểu `bool` ở class con gây lỗi "incompatible property composition".
        $this->afterCommit = true;
    }

    public function handle(): void
    {
        $notification = Notification::with('user')->find($this->notificationId);
        if (!$notification) {
            // Bản ghi đã bị xoá giữa lúc dispatch và lúc worker chạy tới — không
            // còn gì để gửi, không phải lỗi.
            return;
        }

        $reason = NotificationEmailPolicy::reasonToSkip($notification);
        if ($reason !== null) {
            $notification->forceFill([
                'email_status' => 'skipped',
                'email_error'  => $reason,
            ])->save();
            return;
        }

        try {
            Mail::to($notification->user->email)->send(new NotificationMail($notification));

            $notification->forceFill([
                'email_status'  => 'sent',
                'email_sent_at' => now(),
                'email_error'   => null,
            ])->save();
        } catch (Throwable $e) {
            Log::warning('Gửi email thông báo thất bại.', [
                'notification_id' => $notification->id,
                'type'            => $notification->type,
                'error'           => $e->getMessage(),
            ]);

            $notification->forceFill([
                'email_status' => 'failed',
                'email_error'  => substr($e->getMessage(), 0, 500),
            ])->save();

            // Ném lại để queue tự retry theo $tries/$backoff; lần thử cuối cùng
            // fail thì Laravel tự chuyển vào bảng failed_jobs.
            throw $e;
        }
    }
}
