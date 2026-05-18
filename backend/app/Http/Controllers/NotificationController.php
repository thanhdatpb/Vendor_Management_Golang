<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    // GET /api/notifications
    public function index()
    {
        $notifications = Notification::where('user_id', Auth::id())
            ->latest()
            ->take(50)
            ->get();

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
    
    // Thêm phương thức để tạo notification cho Admin
    public function sendToAdmin(Request $request)
    {
        try {
            // Validate dữ liệu
            $request->validate([
                'product_name' => 'required|string',
                'product_type' => 'required|string',
                'user_id' => 'required|exists:users,id'
            ]);
            
            // Lấy tất cả admin (hoặc user có role admin)
            $admins = User::where('role', 'admin')->get();
            
            if ($admins->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Không tìm thấy Admin'
                ], 404);
            }
            
            // Tạo notification cho từng admin
            foreach ($admins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'type' => 'pending',
                    'title' => 'Sản phẩm mới chờ duyệt',
                    'body' => 'Sản phẩm "' . $request->product_name . '" (' . $request->product_type . ') đang chờ Admin phê duyệt',
                    'is_read' => false,
                    'data' => json_encode([
                        'product_id' => $request->product_id ?? null,
                        'user_id' => $request->user_id
                    ])
                ]);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Đã gửi thông báo cho Admin'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi: ' . $e->getMessage()
            ], 500);
        }
    }
}