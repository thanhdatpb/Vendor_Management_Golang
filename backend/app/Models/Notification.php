<?php

namespace App\Models;

use App\Events\NotificationCreated;
use App\Jobs\SendNotificationEmail;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;

class Notification extends Model
{
    protected $table = 'notifications';

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'is_read',
        'data',
    ];

    protected $casts = [
        'is_read' => 'boolean',
    ];

    protected static function booted(): void
    {
        // Chỉ broadcast tín hiệu kỹ thuật; client sẽ tự gọi API đã xác thực để
        // lấy nội dung thông báo thuộc tài khoản hiện tại.
        static::created(function (Notification $notification): void {
            try {
                NotificationCreated::dispatch($notification);
            } catch (\Throwable $exception) {
                // Pusher mất kết nối không được phép làm hỏng nghiệp vụ chính.
                // Polling phía client vẫn sẽ lấy được bản ghi đã lưu trong DB.
                Log::warning('Không broadcast được notification mới.', [
                    'notification_id' => $notification->id,
                    'error' => $exception->getMessage(),
                ]);
            }

            try {
                // Job tự quyết định gửi hay bỏ qua (xem NotificationEmailPolicy) —
                // ở đây chỉ đẩy vào hàng đợi. Lỗi dispatch (vd hàng đợi lỗi kết
                // nối) không được phép làm hỏng thao tác nghiệp vụ đã tạo ra
                // notification này, cùng lý do với nhánh Pusher ở trên.
                SendNotificationEmail::dispatch($notification->id);
            } catch (\Throwable $exception) {
                Log::warning('Không đẩy được job gửi email thông báo.', [
                    'notification_id' => $notification->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
