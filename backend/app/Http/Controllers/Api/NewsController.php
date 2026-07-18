<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\News;
use Illuminate\Http\Request;

/**
 * CRUD cho danh sách "Thông báo" (News) mà Vendor tạo trong màn Quản Lý Thông Báo.
 * Trước đây lưu ở localStorage (STAFF_B_NEWS_V1) — chỉ tồn tại trên 1 máy, đổi máy/
 * xoá cache là mất. Giờ lưu DB để Vendor xem/sửa/xoá được từ bất kỳ thiết bị nào.
 *
 * Route đã bọc middleware role:staff_b,vendor (xem routes/api.php) — chỉ Vendor
 * (tên cũ Staff B) được quản lý danh sách này, giống hệt vendor-library/sample-status.
 */
class NewsController extends Controller
{
    public function index()
    {
        $news = News::orderBy('created_at', 'desc')->get();
        return response()->json($news);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title'   => 'required|string|max:255',
            'message' => 'required|string',
            'target'  => 'nullable', // string ('admin'|'seller'|'both') hoặc mảng tên project
        ]);

        $news = News::create([
            'title'      => $validated['title'],
            'message'    => $validated['message'],
            'target'     => $validated['target'] ?? 'both',
            'created_by' => $request->user()?->id,
        ]);

        return response()->json($news, 201);
    }

    public function update(Request $request, $id)
    {
        $news = News::findOrFail($id);

        $validated = $request->validate([
            'title'   => 'required|string|max:255',
            'message' => 'required|string',
            'target'  => 'nullable',
        ]);

        $news->update([
            'title'   => $validated['title'],
            'message' => $validated['message'],
            'target'  => $validated['target'] ?? $news->target,
        ]);

        return response()->json($news);
    }

    public function destroy($id)
    {
        News::where('id', $id)->delete();
        return response()->json(['message' => 'Đã xoá thông báo']);
    }
}
