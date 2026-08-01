<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;

class SocialAuthController extends Controller
{
    /**
     * Redirect to Google OAuth consent screen.
     */
    public function redirect()
    {
        return Socialite::driver('google')->stateless()->redirect();
    }

    /**
     * Handle Google OAuth callback.
     * 4-layer security check:
     *   1. Google email_verified == true
     *   2. Email exists in users table (allowlist)
     *   3. is_active == true
     *   4. google_id matches (prevent account takeover)
     */
    public function callback()
    {
        $frontendUrl = rtrim(env('FRONTEND_URL', 'https://vendorhub.viehana.com'), '/');

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Exception $e) {
            return redirect($frontendUrl . '/login?error=oauth_failed');
        }

        // Layer 1: Google must have verified the email
        if (!$googleUser->user['email_verified']) {
            return redirect($frontendUrl . '/login?error=email_not_verified');
        }

        $email = strtolower(trim($googleUser->getEmail()));

        // Layer 2: Email must exist (allowlist). 1 email có thể có NHIỀU tài khoản
        // (mỗi role/project 1 dòng) → lấy tất cả.
        $accounts = User::where('email', $email)->get();
        if ($accounts->isEmpty()) {
            return redirect($frontendUrl . '/login?error=account_not_found');
        }

        // Layer 3: phải còn ít nhất 1 tài khoản active
        $active = $accounts->where('is_active', true)->values();
        if ($active->isEmpty()) {
            return redirect($frontendUrl . '/login?error=account_disabled');
        }

        // Layer 4: google_id integrity — kiểm trên bất kỳ dòng nào đã liên kết.
        $incomingGoogleId = $googleUser->getId();
        $linked = $accounts->firstWhere('google_id', $incomingGoogleId)
            ?? $accounts->first(fn ($u) => !empty($u->google_id));
        if ($linked && $linked->google_id !== $incomingGoogleId) {
            return redirect($frontendUrl . '/login?error=identity_mismatch');
        }

        // Lần đầu đăng nhập Google: gắn google_id cho TẤT CẢ dòng cùng email +
        // điền avatar/full_name cho dòng còn thiếu (giữ mọi tài khoản đồng bộ).
        foreach ($accounts as $acc) {
            $patch = [];
            if (empty($acc->google_id)) $patch['google_id'] = $incomingGoogleId;
            // Luôn đồng bộ ảnh đại diện Google (người dùng có thể đổi ảnh bên Google)
            $gAvatar = $googleUser->getAvatar();
            if ($gAvatar && $acc->avatar_url !== $gAvatar) $patch['avatar_url'] = $gAvatar;
            if (empty($acc->full_name)) $patch['full_name'] = $googleUser->getName();
            if (!$patch) continue;
            $this->syncProfileFromGoogle($acc, $patch);
        }

        // Chỉ hỏi chọn khi các tài khoản KHÁC VAI TRÒ. Cùng vai trò mà khác project
        // (vd PD làm 2 project) → vào thẳng, sidebar hiển thị đủ project.
        if ($active->count() === 1 || $active->pluck('role')->unique()->count() === 1) {
            $token = $active->first()->createToken('google_auth')->plainTextToken;
            return redirect($frontendUrl . '/auth/callback?token=' . urlencode($token));
        }

        $ticket   = AuthController::makeSelectionTicket($email);
        $accountsB64 = base64_encode(json_encode(
            $active->map(fn ($u) => AuthController::accountSummary($u))->all()
        ));

        return redirect($frontendUrl . '/auth/callback?select=' . urlencode($ticket) . '&accounts=' . urlencode($accountsB64));
    }

    /**
     * Ghi thông tin hồ sơ lấy từ Google vào 1 dòng user.
     *
     * Đồng bộ hồ sơ là việc PHỤ, chạy trước khi phát token — nên mọi lỗi ở đây
     * phải nuốt lại, không được ném ra ngoài làm hỏng đăng nhập. Đã có 2 sự cố
     * 500 đúng vì lý do này:
     *   - google_id còn UNIQUE trên DB (1 email nhiều dòng role/project)
     *     → UniqueConstraintViolation (đã sửa ở migration 2026_07_27_000001).
     *   - avatar_url là VARCHAR(500) mà URL avatar Google dài >1000 ký tự
     *     → SQLSTATE 22001 "Data too long" (đã nới thành TEXT ở migration
     *       2026_08_01_000001).
     *
     * Cả 2 migration có thể chưa chạy trên một DB nào đó, nên vẫn bỏ dần trường
     * gây lỗi rồi thử lại: ưu tiên giữ được google_id (cần cho Layer 4) hơn ảnh.
     *
     * BẮT BUỘC discardChanges() trước mỗi lần thử lại: Eloquent::update() =
     * fill() + save(), mà fill() đã nhét giá trị vào model TRƯỚC khi câu SQL nổ.
     * Thuộc tính hỏng vẫn nằm đó ở trạng thái "dirty", nên lần update sau — dù
     * chỉ truyền google_id — save() vẫn gom luôn avatar_url cũ vào câu UPDATE và
     * lỗi y hệt. Đó là lý do trên production tài khoản vào được hệ thống nhưng
     * cột google_id vẫn NULL (2026-08-01).
     */
    private function syncProfileFromGoogle(User $acc, array $patch): void
    {
        try {
            $acc->update($patch);
            return;
        } catch (\Throwable $e) {
            $acc->discardChanges();
            \Log::warning('Google login: lỗi đồng bộ hồ sơ, thử bỏ bớt trường', [
                'user_id' => $acc->id, 'fields' => array_keys($patch), 'error' => $e->getMessage(),
            ]);
        }

        // Nghi phạm số 1: avatar_url quá dài so với cột.
        if (array_key_exists('avatar_url', $patch)) {
            unset($patch['avatar_url']);
            if (!$patch) return;
            try {
                $acc->update($patch);
                return;
            } catch (\Throwable $e) {
                $acc->discardChanges();
                \Log::warning('Google login: vẫn lỗi sau khi bỏ avatar_url', [
                    'user_id' => $acc->id, 'error' => $e->getMessage(),
                ]);
            }
        }

        // Nghi phạm số 2: google_id vướng unique cũ.
        unset($patch['google_id']);
        if (!$patch) return;
        try {
            $acc->update($patch);
        } catch (\Throwable $e) {
            \Log::warning('Google login: bỏ qua đồng bộ hồ sơ', [
                'user_id' => $acc->id, 'error' => $e->getMessage(),
            ]);
        }
    }
}
