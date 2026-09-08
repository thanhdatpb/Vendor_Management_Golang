<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Một ô trong ma trận "role × loại thông báo" — có gửi mail hay không.
 * Xem migration tạo bảng để biết vì sao chỉ seed các cặp thực sự xảy ra.
 */
class NotificationEmailSetting extends Model
{
    protected $table = 'notification_email_settings';

    protected $fillable = [
        'role',
        'type',
        'enabled',
        'updated_by',
    ];

    protected $casts = [
        'enabled' => 'boolean',
    ];
}
