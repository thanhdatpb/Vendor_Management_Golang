<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ghi lại mốc thao tác gần nhất của người đang đăng nhập.
 *
 * Đặt TRONG nhóm `auth:sanctum` chứ không phải nhóm `api` toàn cục: guard mặc
 * định của dự án là `web` (config/auth.php), nên gọi `$request->user()` bên
 * ngoài nhóm đó sẽ luôn trả null với request dùng token.
 *
 * Ba nguyên tắc để không đụng tới hiệu năng và tính đúng đắn của hệ thống:
 *
 *  1. CHẶN BỚT — mỗi người tối đa 1 lần ghi trong THROTTLE_MINUTES phút. Không
 *     có nó thì mỗi request là một lần UPDATE, và màn hình nào cũng gọi vài API.
 *  2. KHÔNG đụng `updated_at` — dùng query builder thay vì Eloquent save, nếu
 *     không mỗi lần xem trang là một lần "sửa tài khoản" trong mắt phần còn lại
 *     của hệ thống.
 *  3. Lỗi ghi KHÔNG được làm hỏng request — đây là dữ liệu phụ trợ. Cùng lắm là
 *     mốc thời gian bị cũ, không đáng để người dùng nhận lỗi 500.
 */
class TouchLastSeen
{
    /** Khoảng chặn giữa hai lần ghi cho cùng một người. */
    private const THROTTLE_MINUTES = 5;

    public function handle(Request $request, Closure $next): Response
    {
        // Chạy TRƯỚC khi trả response: nếu chạy sau, request bị abort giữa
        // chừng (403/422) sẽ không được tính là một lần truy cập — mà nó có.
        $this->touch($request);

        return $next($request);
    }

    private function touch(Request $request): void
    {
        $user = $request->user();
        if (!$user) {
            return;
        }

        $key = 'last_seen_touched_' . $user->getKey();

        try {
            // `add` trả false nếu khoá còn hiệu lực → chưa tới lượt ghi.
            if (!Cache::add($key, true, now()->addMinutes(self::THROTTLE_MINUTES))) {
                return;
            }

            DB::table('users')->where('id', $user->getKey())->update(['last_seen_at' => now()]);
        } catch (\Throwable $e) {
            Log::warning('Không ghi được mốc truy cập cuối.', [
                'user_id' => $user->getKey(),
                'error'   => $e->getMessage(),
            ]);
        }
    }
}
