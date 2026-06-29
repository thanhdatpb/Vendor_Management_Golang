<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class AdminUserController extends Controller
{
    private static array $VALID_PROJECTS = ['Happy Project', 'Creative Project', 'Global Project', 'Hapify84 Project'];

    // =========================
    // GET /api/admin/users
    // Danh sách tất cả nhân sự
    // =========================
    public function index(Request $request)
    {
        $users = User::select('id', 'email', 'full_name', 'name', 'role', 'project', 'is_active', 'avatar_url', 'created_at')
            ->orderByRaw("FIELD(role, 'admin', 'vendor', 'seller')")
            ->orderBy('project')
            ->orderBy('full_name')
            ->get()
            ->map(fn($u) => [
                'id'        => $u->id,
                'email'     => $u->email,
                'full_name' => $u->full_name ?: $u->name,
                'role'      => $u->role,
                'project'   => $u->project,
                'is_active' => (bool) $u->is_active,
                'avatar_url'=> $u->avatar_url,
            ]);

        return response()->json(['users' => $users]);
    }

    // =========================
    // POST /api/admin/users
    // Thêm nhân sự mới
    // =========================
    public function store(Request $request)
    {
        $validated = $request->validate([
            'email'     => [
                'required', 'email',
                Rule::unique('users', 'email'),
            ],
            'full_name' => 'required|string|max:255',
            'role'      => ['required', Rule::in(['admin', 'vendor', 'seller'])],
            'project'   => [
                Rule::requiredIf($request->role === 'seller'),
                'nullable',
                Rule::in(self::$VALID_PROJECTS),
            ],
        ], [
            'email.unique'   => 'Email này đã tồn tại trong hệ thống',
            'project.required_if' => 'Project là bắt buộc khi role là seller',
            'project.in'     => 'Project không hợp lệ',
        ]);

        $user = User::create([
            'email'     => strtolower(trim($validated['email'])),
            'full_name' => $validated['full_name'],
            'name'      => $validated['full_name'],
            'role'      => $validated['role'],
            'project'   => $validated['role'] === 'seller' ? $validated['project'] : null,
            'is_active' => true,
            'password'  => null,
        ]);

        $this->auditLog($request, 'CREATE_USER', null, $user);

        return response()->json([
            'message' => 'Thêm nhân sự thành công',
            'user'    => [
                'id'        => $user->id,
                'email'     => $user->email,
                'full_name' => $user->full_name,
                'role'      => $user->role,
                'project'   => $user->project,
                'is_active' => true,
            ],
        ], 201);
    }

    // =========================
    // PATCH /api/admin/users/{id}
    // Sửa role / project / full_name
    // =========================
    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $actor = $request->user();

        $validated = $request->validate([
            'full_name' => 'sometimes|string|max:255',
            'role'      => ['sometimes', Rule::in(['admin', 'vendor', 'seller'])],
            'project'   => ['nullable', Rule::in(array_merge(self::$VALID_PROJECTS, [null]))],
        ]);

        $newRole = $validated['role'] ?? $user->role;

        // Nếu hạ role admin → kiểm tra vẫn còn ít nhất 1 admin active khác
        if ($user->role === 'admin' && $newRole !== 'admin') {
            $remainingAdmins = User::where('role', 'admin')
                ->where('is_active', true)
                ->where('id', '!=', $user->id)
                ->count();

            if ($remainingAdmins < 1) {
                return response()->json([
                    'message' => 'Phải còn ít nhất 1 admin hoạt động trong hệ thống'
                ], 422);
            }
        }

        $before = $user->only(['full_name', 'role', 'project']);

        $user->update([
            'full_name' => $validated['full_name'] ?? $user->full_name,
            'name'      => $validated['full_name'] ?? $user->name,
            'role'      => $newRole,
            'project'   => $newRole === 'seller'
                ? ($validated['project'] ?? $user->project)
                : null,
        ]);

        $this->auditLog($request, 'UPDATE_USER', $before, $user);

        return response()->json(['message' => 'Cập nhật thành công', 'user' => $user->fresh()]);
    }

    // =========================
    // PATCH /api/admin/users/{id}/status
    // Khoá / Mở tài khoản
    // =========================
    public function toggleStatus(Request $request, $id)
    {
        $user  = User::findOrFail($id);
        $actor = $request->user();

        $lock = !$user->is_active === false; // sẽ khoá nếu đang active
        $willLock = $user->is_active;        // true = đang mở → sắp khoá

        // Không cho khoá chính mình
        if ($actor->id === $user->id && $willLock) {
            return response()->json(['message' => 'Không thể tự khoá tài khoản của chính mình'], 422);
        }

        // Ràng buộc: luôn còn ít nhất 1 admin active
        if ($user->role === 'admin' && $willLock) {
            $remainingAdmins = User::where('role', 'admin')
                ->where('is_active', true)
                ->where('id', '!=', $user->id)
                ->count();

            if ($remainingAdmins < 1) {
                return response()->json([
                    'message' => 'Phải còn ít nhất 1 admin hoạt động trong hệ thống'
                ], 422);
            }
        }

        $user->update(['is_active' => !$user->is_active]);

        // Đá phiên ngay khi khoá
        if (!$user->is_active) {
            $user->tokens()->delete();
        }

        $action = $user->is_active ? 'UNLOCK_USER' : 'LOCK_USER';
        $this->auditLog($request, $action, null, $user);

        return response()->json([
            'message'   => $user->is_active ? 'Đã mở khoá tài khoản' : 'Đã khoá tài khoản',
            'is_active' => $user->is_active,
        ]);
    }

    // =========================
    // Ghi audit log
    // =========================
    private function auditLog(Request $request, string $action, ?array $before, User $target): void
    {
        $actor = $request->user();
        Log::channel('stack')->info('ADMIN_AUDIT', [
            'action'    => $action,
            'actor_id'  => $actor?->id,
            'actor_email' => $actor?->email,
            'target_id' => $target->id,
            'target_email' => $target->email,
            'before'    => $before,
            'after'     => $target->only(['full_name', 'role', 'project', 'is_active']),
            'ip'        => $request->ip(),
            'at'        => now()->toISOString(),
        ]);
    }
}
