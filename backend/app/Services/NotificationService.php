<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

class NotificationService
{
    /**
     * Gửi thông báo đến 1 user cụ thể
     */
    public static function send(int $userId, string $type, string $title, string $body, ?array $data = null): void
    {
        Notification::create([
            'user_id' => $userId,
            'type'    => $type,
            'title'   => $title,
            'body'    => $body,
            'is_read' => false,
            'data'    => $data ? json_encode($data) : null,
        ]);
    }

    /**
     * Gửi thông báo đến tất cả user có role nhất định
     * VD: role = 'admin', 'seller', 'vendor'. Có thể truyền mảng để gộp cả tên role cũ/mới.
     */
    public static function sendToRole(string|array $role, string $type, string $title, string $body, ?array $data = null): void
    {
        // pluck('id') thay vì get(): chỉ cần id, không việc gì phải nạp cả model
        // (avatar_url TEXT, pd_projects JSON...) cho mỗi lần bắn thông báo.
        // Vẫn tạo từng bản ghi qua Model — KHÔNG gộp thành insert hàng loạt, vì
        // insert thẳng bỏ qua event `created` của Notification, tức mất cả
        // broadcast Pusher lẫn job gửi email mirror.
        $userIds = User::whereIn('role', (array) $role)->pluck('id');

        foreach ($userIds as $userId) {
            self::send($userId, $type, $title, $body, $data);
        }
    }

    /**
     * Gửi đến nhiều user IDs
     */
    public static function sendToUsers(array $userIds, string $type, string $title, string $body, ?array $data = null): void
    {
        foreach ($userIds as $userId) {
            self::send($userId, $type, $title, $body, $data);
        }
    }
}