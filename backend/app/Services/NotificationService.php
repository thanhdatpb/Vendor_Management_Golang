<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;

class NotificationService
{
    /**
     * Gửi thông báo đến 1 user cụ thể
     */
    public static function send(int $userId, string $type, string $title, string $body): void
    {
        Notification::create([
            'user_id' => $userId,
            'type'    => $type,
            'title'   => $title,
            'body'    => $body,
            'is_read' => false,
        ]);
    }

    /**
     * Gửi thông báo đến tất cả user có role nhất định
     * VD: role = 'admin', 'staff', 'staff_a', 'staff_b'
     */
    public static function sendToRole(string $role, string $type, string $title, string $body): void
    {
        $users = User::where('role', $role)->get();
        foreach ($users as $user) {
            self::send($user->id, $type, $title, $body);
        }
    }

    /**
     * Gửi đến nhiều user IDs
     */
    public static function sendToUsers(array $userIds, string $type, string $title, string $body): void
    {
        foreach ($userIds as $userId) {
            self::send($userId, $type, $title, $body);
        }
    }
}