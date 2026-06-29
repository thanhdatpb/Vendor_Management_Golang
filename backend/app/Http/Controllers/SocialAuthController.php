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

        // Layer 2: Email must exist in our allowlist (users table)
        $user = User::where('email', $email)->first();
        if (!$user) {
            return redirect($frontendUrl . '/login?error=account_not_found');
        }

        // Layer 3: Account must be active
        if (!$user->is_active) {
            return redirect($frontendUrl . '/login?error=account_disabled');
        }

        // Layer 4: google_id integrity check
        $incomingGoogleId = $googleUser->getId();
        if ($user->google_id && $user->google_id !== $incomingGoogleId) {
            return redirect($frontendUrl . '/login?error=identity_mismatch');
        }

        // First Google login: persist google_id and avatar
        if (!$user->google_id) {
            $user->update([
                'google_id'  => $incomingGoogleId,
                'avatar_url' => $googleUser->getAvatar(),
                'full_name'  => $user->full_name ?: $googleUser->getName(),
            ]);
        }

        // Issue a Sanctum token (our own token, NOT Google's)
        $token = $user->createToken('google_auth')->plainTextToken;

        return redirect($frontendUrl . '/auth/callback?token=' . urlencode($token));
    }
}
