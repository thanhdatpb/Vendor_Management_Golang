<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    // GET /api/notifications
    public function index()
    {
        // Thông báo "Chờ duyệt" (type=pending) loại cũ được dọn MỘT LẦN bằng
        // migration 2026_09_14_000003, không dọn ở đây nữa: mỗi dashboard poll
        // endpoint này 15 giây/lần nên câu DELETE cũ biến mỗi lần xem thành một
        // lần ghi DB. Không còn chỗ nào tạo type='pending' nên không thể quay lại.
        $notifications = Notification::where('user_id', Auth::id())
            ->latest()
            ->take(50)
            ->get()
            ->map(function ($n) {
                if ($n->data && is_string($n->data)) {
                    $parsed = json_decode($n->data, true);
                    $n->data = is_array($parsed) ? $parsed : null;
                }
                return $n;
            });

        $unread = Notification::where('user_id', Auth::id())
            ->where('is_read', false)
            ->count();

        return response()->json([
            'data'   => $notifications,
            'unread' => $unread,
        ]);
    }

    // POST /api/notifications/read-all
    public function markAllRead()
    {
        Notification::where('user_id', Auth::id())
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['success' => true]);
    }

    // POST /api/notifications/{id}/read
    public function markOneRead($id)
    {
        Notification::where('id', $id)
            ->where('user_id', Auth::id())
            ->update(['is_read' => true]);

        return response()->json(['success' => true]);
    }
}
