<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{

    // =========================
    // LOGIN
    // =========================
    public function login(Request $request)
    {

        $request->validate([
            'email' => 'required',
            'password' => 'required'
        ]);

        // Tìm user theo email
        $user = User::where('email', $request->email)->first();

        // Email không tồn tại
        if (!$user) {
            return response()->json([
                'message' => 'Email không tồn tại'
            ], 401);
        }

        // Sai mật khẩu
        if (!Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Mật khẩu sai'
            ], 401);
        }

        // Tạo token Sanctum
        $token = $user->createToken('auth_token')->plainTextToken;

        // Trả response cho frontend (THÊM seller_name)
        return response()->json([
            'message' => 'Login success',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'seller_name' => $user->seller_name  // ← THÊM DÒNG NÀY
            ]
        ]);
    }


    // =========================
    // LOGOUT
    // =========================
    public function logout(Request $request)
    {

        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout success'
        ]);
    }


    // =========================
    // GET CURRENT USER
    // =========================
    public function me(Request $request)
    {

        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'seller_name' => $user->seller_name  // ← THÊM DÒNG NÀY
            ]
        ]);
    }

}