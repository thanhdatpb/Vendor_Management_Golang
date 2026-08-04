<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\News;
use App\Services\NotificationService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * CRUD cho danh sách "Thông báo" (News) mà Vendor tạo trong màn Quản Lý Thông Báo.
 * Trước đây lưu ở localStorage (STAFF_B_NEWS_V1) — chỉ tồn tại trên 1 máy, đổi máy/
 * xoá cache là mất. Giờ lưu DB để Vendor xem/sửa/xoá được từ bất kỳ thiết bị nào.
 *
 * Route đã bọc middleware role:staff_b,vendor (xem routes/api.php) — chỉ Vendor
 * (tên cũ Staff B) được quản lý danh sách này, giống hệt vendor-library/sample-status.
 *
 * Vòng đời một thông báo:
 *   store()  → bản nháp (sent_at = NULL), Vendor còn sửa/xoá/gửi được.
 *   send()   → fan-out thành notification cho Admin & Seller, đóng dấu sent_at.
 *   sau đó   → khoá: update/destroy/send đều trả 409.
 *
 * Việc fan-out phải nằm ở server. Bản cũ đẩy từ client qua pushNotifMulti() →
 * POST /notifications, nhưng route đó chưa từng tồn tại nên request luôn 404 và
 * rơi vào fallback localStorage của chính máy Vendor — Admin/Seller ở máy khác
 * không bao giờ nhận được gì.
 */
class NewsController extends Controller
{
    /** Role nhận thông báo — kèm cả tên role cũ để không sót tài khoản legacy. */
    private const RECIPIENT_ROLES = ['admin', 'seller', 'staff_a'];

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

        // Tạo ra là bản nháp: chưa gửi cho ai, Vendor còn soát lại nội dung rồi mới
        // bấm Gửi. sent_at để NULL.
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

        if ($news->isSent()) {
            return $this->alreadySentResponse('sửa');
        }

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
        $news = News::findOrFail($id);

        if ($news->isSent()) {
            return $this->alreadySentResponse('xoá');
        }

        $news->delete();

        return response()->json(['message' => 'Đã xoá thông báo']);
    }

    /**
     * POST /api/news/{id}/send — phát thông báo tới chuông của Admin & toàn bộ Seller.
     *
     * Gửi đúng một lần: chốt sent_at ngay trong transaction rồi mới fan-out, để hai
     * request bấm Gửi song song không tạo hai lượt notification trùng nhau.
     */
    public function send($id)
    {
        $news = News::findOrFail($id);

        if ($news->isSent()) {
            return $this->alreadySentResponse('gửi lại');
        }

        // Cột sent_at do migration 2026_08_04_000001 tạo ra. Deploy của dự án là thủ
        // công nên rất dễ `git pull` xong quên `php artisan migrate` — khi đó câu
        // update phía dưới ném SQLSTATE[42S22] và (nếu server để APP_DEBUG=true)
        // Laravel trả nguyên chuỗi SQL kèm host/port/tên database ra tận toast của
        // người dùng cuối. Chặn sớm, nói thẳng việc cần làm.
        if (!Schema::hasColumn('news', 'sent_at')) {
            Log::error('news.sent_at chưa tồn tại — server chưa chạy "php artisan migrate" sau khi cập nhật code.');

            return response()->json([
                'message' => 'Máy chủ chưa cập nhật cơ sở dữ liệu (thiếu cột news.sent_at). '
                    . 'Vui lòng báo quản trị viên chạy "php artisan migrate" rồi thử lại.',
            ], 503);
        }

        // Khoá dòng news rồi kiểm tra lại sent_at: nếu request khác vừa gửi xong
        // trong lúc mình chờ khoá thì dừng, không phát trùng.
        $claimed = DB::transaction(function () use ($news) {
            $fresh = News::lockForUpdate()->find($news->id);
            if (!$fresh || $fresh->sent_at !== null) {
                return null;
            }
            $fresh->sent_at = now();
            $fresh->save();
            return $fresh;
        });

        if (!$claimed) {
            return $this->alreadySentResponse('gửi lại');
        }

        try {
            NotificationService::sendToRole(
                self::RECIPIENT_ROLES,
                'news',
                $claimed->title,
                $claimed->message,
                [
                    'news_id' => (int) $claimed->id,
                    'icon'    => '📰',
                    'source'  => 'staff_b',
                ]
            );
        } catch (QueryException $e) {
            // sent_at đã commit ở trên rồi mới fan-out lỗi (thiếu cột notifications.*,
            // JSON hỏng, deadlock…) — nếu không nhả lại, tin bị khoá VĨNH VIỄN ở trạng
            // thái "đã gửi" dù chưa ai nhận được gì: send/update/destroy sau đó đều 409,
            // không còn cách nào gửi lại hay sửa ngoài can thiệp thẳng vào DB.
            News::where('id', $claimed->id)->whereNotNull('sent_at')->update(['sent_at' => null]);

            Log::error('Gửi thông báo thất bại', ['news_id' => $id, 'error' => $e->getMessage()]);

            return response()->json([
                'message' => 'Không gửi được thông báo do lỗi cơ sở dữ liệu. Vui lòng thử lại hoặc báo quản trị viên.',
            ], 500);
        }

        return response()->json($claimed);
    }

    private function alreadySentResponse(string $action)
    {
        return response()->json([
            'message' => "Thông báo đã được gửi tới Admin & Seller nên không thể {$action}.",
        ], 409);
    }
}
