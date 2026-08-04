<?php

namespace App\Models;

use App\Events\NotificationCreated;
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
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
