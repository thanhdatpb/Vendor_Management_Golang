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
            if (empty($acc->google_id))  $patch['google_id']  = $incomingGoogleId;
            if (empty($acc->avatar_url)) $patch['avatar_url'] = $googleUser->getAvatar();
            if (empty($acc->full_name))  $patch['full_name']  = $googleUser->getName();
            if ($patch) $acc->update($patch);
        }

        // 1 tài khoản → đăng nhập luôn; nhiều tài khoản → chuyển sang bước chọn.
        if ($active->count() === 1) {
            $token = $active->first()->createToken('google_auth')->plainTextToken;
            return redirect($frontendUrl . '/auth/callback?token=' . urlencode($token));
        }

        $ticket   = AuthController::makeSelectionTicket($email);
        $accountsB64 = base64_encode(json_encode(
            $active->map(fn ($u) => AuthController::accountSummary($u))->all()
        ));

        return redirect($frontendUrl . '/auth/callback?select=' . urlencode($ticket) . '&accounts=' . urlencode($accountsB64));
    }
}
