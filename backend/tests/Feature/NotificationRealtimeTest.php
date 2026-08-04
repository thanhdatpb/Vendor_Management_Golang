<?php

namespace Tests\Feature;

use App\Events\NotificationCreated;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class NotificationRealtimeTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_notification_dispatches_realtime_signal_for_recipient(): void
    {
        $user = User::factory()->create();
        Event::fake([NotificationCreated::class]);

        $notification = Notification::create([
            'user_id' => $user->id,
            'type' => 'news',
            'title' => 'Thông báo mới',
            'body' => 'Nội dung',
            'is_read' => false,
        ]);

        Event::assertDispatched(
            NotificationCreated::class,
            fn (NotificationCreated $event) =>
                $event->notificationId === $notification->id
                && $event->userId === $user->id
        );
    }
}
