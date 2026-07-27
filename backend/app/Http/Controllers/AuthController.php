<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Crypt;

class AuthController extends Controller
{
    // Payload user trả về cho client (dùng chung login / select-account / me).
    public static function userPayload(User $user): array
    {
        return [
            'id'          => $user->id,
            'name'        => $user->name,
            'full_name'   => $user->full_name,
            'email'       => $user->email,
            'role'        => $user->role,
            'project'     => $user->project,
            // Tất cả project mà email này được cấp CÙNG vai trò — để UI (vd PD)
            // hiển thị đủ các project ở sidebar, giống CSF.
            'projects'    => self::projectsFor($user),
            'seller_name' => $user->seller_name,
            'avatar_url'  => $user->avatar_url,
        ];
    }

    /** Danh sách project của các tài khoản đang hoạt động cùng email + cùng role. */
    public static function projectsFor(User $user): array
    {
        return User::where('email', $user->email)
            ->where('role', $user->role)
            ->where('is_active', true)
            ->whereNotNull('project')
            ->orderBy('project')
            ->pluck('project')
            ->unique()
            ->values()
            ->all();
    }

    // Tóm tắt 1 tài khoản để hiển thị ở bước chọn (không lộ gì nhạy cảm).
    public static function accountSummary(User $user): array
    {
        return [
            'id'      => $user->id,
            'role'    => $user->role,
            'project' => $user->project,
            'full_name' => $user->full_name ?: $user->name,
        ];
    }

    // Vé chọn tài khoản: mã hoá bằng APP_KEY, chứng minh email đã xác thực. Hết hạn 10'.
    public static function makeSelectionTicket(string $email): string
    {
        return Crypt::encryptString(json_encode(['email' => $email, 'exp' => time() + 600]));
    }

    // =========================
    // LOGIN (email + password)
    // =========================
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required',
            'password' => 'required',
        ]);

        $email = strtolower(trim($request->email));

        // 1 email có thể ứng với NHIỀU tài khoản (role/project khác nhau).
        $accounts = User::where('email', $email)->where('is_active', true)->get();

        if ($accounts->isEmpty()) {
            return response()->json(['message' => 'Email không tồn tại'], 401);
        }

        // Chỉ giữ các tài khoản có mật khẩu khớp.
        $matched = $accounts->filter(
            fn ($u) => $u->password && Hash::check($request->password, $u->password)
        )->values();

        if ($matched->isEmpty()) {
            return response()->json(['message' => 'Mật khẩu sai'], 401);
        }

        // Chỉ hỏi chọn khi các tài khoản KHÁC VAI TRÒ. Nếu cùng vai trò mà khác
        // project (vd PD làm 2 project) thì vào thẳng — sidebar hiển thị đủ project.
        if ($matched->pluck('role')->unique()->count() > 1) {
            return response()->json([
                'needs_selection' => true,
                'ticket'   => self::makeSelectionTicket($email),
                'accounts' => $matched->map(fn ($u) => self::accountSummary($u))->all(),
            ]);
        }

        $user  = $matched->first();
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login success',
            'token'   => $token,
            'user'    => self::userPayload($user),
        ]);
    }

    // =========================
    // SELECT ACCOUNT
    // Hoàn tất đăng nhập khi 1 email có nhiều tài khoản (dùng cho cả password & Google).
    // =========================
    public function selectAccount(Request $request)
    {
        $request->validate([
            'ticket'     => 'required|string',
            'account_id' => 'required',
        ]);

        try {
            $payload = json_decode(Crypt::decryptString($request->ticket), true);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Phiên chọn tài khoản không hợp lệ'], 422);
        }

        if (!is_array($payload) || empty($payload['email']) || ($payload['exp'] ?? 0) < time()) {
            return response()->json(['message' => 'Phiên đã hết hạn, vui lòng đăng nhập lại'], 422);
        }

        // account_id phải thuộc đúng email đã xác thực trong vé + đang hoạt động.
        $user = User::where('id', $request->account_id)
            ->where('email', $payload['email'])
            ->where('is_active', true)
            ->first();

        if (!$user) {
            return response()->json(['message' => 'Tài khoản không hợp lệ hoặc đã bị khoá'], 422);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login success',
            'token'   => $token,
            'user'    => self::userPayload($user),
        ]);
    }

    // =========================
    // LOGOUT
    // =========================
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logout success']);
    }

    // =========================
    // GET CURRENT USER
    // =========================
    public function me(Request $request)
    {
        return response()->json(['user' => self::userPayload($request->user())]);
    }
}
