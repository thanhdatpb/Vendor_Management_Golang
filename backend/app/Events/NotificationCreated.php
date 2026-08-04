<?php

namespace App\Events;

use App\Models\Notification;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NotificationCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $notificationId;
    public int $userId;

    public function __construct(Notification $notification)
    {
        $this->notificationId = (int) $notification->id;
        $this->userId = (int) $notification->user_id;
    }

    public function broadcastOn(): array
    {
        return [new Channel('notifications')];
    }

    public function broadcastAs(): string
    {
        return 'NotificationCreated';
    }
}
