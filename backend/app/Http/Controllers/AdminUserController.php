<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
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
        // `last_seen_at` và `pd_projects` là cột MỚI. Nếu code lên trước khi
        // `php artisan migrate` chạy, select thẳng chúng sẽ ném 1054 Unknown
        // column → 500 → màn hình Quản Lý Nhân Sự trắng trơn và trông y như đã
        // mất sạch nhân sự. Chuyện này đã xảy ra thật trên production
        // 2026-08-18 (với last_seen_at) rồi lặp lại lần nữa với pd_projects
        // (2026-08-26) — deploy thủ công không đảm bảo migrate chạy cùng lúc
        // với code. Thiếu cột thì bỏ qua, chỉ mất đúng cột hiển thị đó.
        $columns = ['id', 'email', 'full_name', 'name', 'role', 'project', 'is_active', 'avatar_url', 'created_at'];
        $hasLastSeen = Schema::hasColumn('users', 'last_seen_at');
        if ($hasLastSeen) {
            $columns[] = 'last_seen_at';
        } else {
            Log::warning('users.last_seen_at chưa tồn tại — cần chạy php artisan migrate.');
        }
        $hasPdProjects = Schema::hasColumn('users', 'pd_projects');
        if ($hasPdProjects) {
            $columns[] = 'pd_projects';
        } else {
            Log::warning('users.pd_projects chưa tồn tại — cần chạy php artisan migrate.');
        }

        $users = User::select($columns)
            // `FIELD()` chỉ có ở MySQL — endpoint này vì thế không test được trên
            // SQLite (500: no such function: FIELD). CASE cho đúng thứ tự đó và
            // chạy trên cả hai. `ELSE 0` giữ nguyên hành vi cũ: role lạ xếp đầu.
            ->orderByRaw("CASE role
                WHEN 'admin'  THEN 1
                WHEN 'vendor' THEN 2
                WHEN 'csf'    THEN 3
                WHEN 'marvel' THEN 4
                WHEN 'seller' THEN 5
                WHEN 'pd'     THEN 6
                ELSE 0 END")
            ->orderBy('project')
            ->orderBy('full_name')
            ->get()
            ->map(fn($u) => [
                'id'          => $u->id,
                'email'       => $u->email,
                'full_name'   => $u->full_name ?: $u->name,
                'role'        => $u->role,
                'project'     => $u->project,
                'pd_projects' => $hasPdProjects ? ($u->pd_projects ?? []) : [],
                'is_active'   => (bool) $u->is_active,
                'avatar_url'=> $u->avatar_url,
                // Mốc thao tác gần nhất. null = chưa truy cập lần nào kể từ khi
                // tính năng này được bật.
                'last_seen_at' => $hasLastSeen ? optional($u->last_seen_at)->toIso8601String() : null,
            ]);

        return response()->json(['users' => $users]);
    }

    // =========================
    // POST /api/admin/users
    // Thêm nhân sự mới
    // =========================
    public function store(Request $request)
    {
        // Không còn chặn unique email: 1 email được thêm vào nhiều (role, project).
        // Tính duy nhất chuyển sang cặp (email, role, project) — kiểm ở dưới.
        $validated = $request->validate([
            'email'     => ['required', 'email'],
            'full_name' => 'required|string|max:255',
            'role'      => ['required', Rule::in(['admin', 'vendor', 'seller', 'pd', 'csf', 'marvel'])],
            'project'   => [
                // PD tra cứu thư viện của MỌI project nên không cần gán project.
                // Vẫn nhận nếu Admin có gửi — chỉ là không bắt buộc và không dùng
                // để phân quyền nữa.
                Rule::requiredIf(in_array($request->role, ['seller'])),
                'nullable',
                Rule::in(self::$VALID_PROJECTS),
            ],
            // Danh sách project PD được tick chọn ở Quản Lý Nhân Sự — PD chỉ
            // thấy đúng các project này (khác với `project` ở trên, vốn không
            // dùng để phân quyền PD nữa).
            'pd_projects'   => ['nullable', 'array'],
            'pd_projects.*' => [Rule::in(self::$VALID_PROJECTS)],
        ], [
            'project.required_if' => 'Project là bắt buộc khi role là seller',
            'project.in'     => 'Project không hợp lệ',
            'pd_projects.*.in' => 'Project không hợp lệ',
        ]);

        $email = strtolower(trim($validated['email']));
        // `keepsProject` = role có LƯU project hay không (seller bắt buộc, PD tuỳ ý).
        // Khác với "cần project để phân quyền" — PD không dùng project nữa.
        $keepsProject = in_array($validated['role'], ['seller', 'pd']);
        $project      = $keepsProject ? ($validated['project'] ?? null) : null;
        // Cột `pd_projects` có thể CHƯA tồn tại nếu deploy code trước khi chạy
        // migrate (xem chú thích ở index()) — insert thẳng tên cột không có
        // thật sẽ ném 1054 Unknown column. Thiếu cột thì bỏ qua, PD vẫn tạo
        // được (chỉ là chưa gán được project truy cập cho tới khi migrate).
        $hasPdProjects = Schema::hasColumn('users', 'pd_projects');
        $pdProjects   = $hasPdProjects && $validated['role'] === 'pd' ? array_values($validated['pd_projects'] ?? []) : null;

        // PD không còn dùng project để phân biệt tài khoản (mọi dòng PD đều thấy
        // MỌI project như nhau) — nên với PD, trùng chỉ cần xét email + role, KHÔNG
        // xét project. Nếu vẫn cho tạo "PD khác project" như trước, Admin lại tạo ra
        // 2 dòng cho cùng một người: hiển thị trùng ở Quản Lý Nhân Sự, và nguy hiểm
        // hơn — nút Khoá chỉ khoá đúng 1 `id`, dòng còn lại vẫn đăng nhập được vì
        // AuthController::login lấy $matched->first() khi trùng role (sự cố thật,
        // tài khoản "Lam Nguyen" x2 trên production 2026-08-18).
        //
        // Role còn lại (seller...) vẫn chặn theo cặp (email + role + project) như cũ:
        // 1 người làm Seller ở 2 project là hợp lệ, không phải trùng.
        if ($validated['role'] === 'pd') {
            $dupQuery = User::where('email', $email)->where('role', 'pd');
            $dupMessage = 'Email này đã có tài khoản PD rồi — PD không cần tạo riêng theo project.';
        } else {
            $dupQuery = User::where('email', $email)->where('role', $validated['role']);
            // `where('project', null)` sinh ra `= NULL` — không bao giờ khớp. Phải whereNull.
            $project !== null ? $dupQuery->where('project', $project) : $dupQuery->whereNull('project');
            $dupMessage = $project !== null
                ? 'Email này đã có ở role "' . $validated['role'] . '" cho project này rồi'
                : 'Email này đã có ở role "' . $validated['role'] . '" rồi';
        }
        if ($dupQuery->exists()) {
            return response()->json(['message' => $dupMessage], 422);
        }

        // Nếu email đã tồn tại ở tài khoản khác → kế thừa liên kết Google (google_id,
        // avatar) để đăng nhập Google hoạt động ngay cho vai trò/project mới này.
        $sibling = User::where('email', $email)->whereNotNull('google_id')->first();

        $user = User::create([
            'email'      => $email,
            'full_name'  => $validated['full_name'],
            'name'       => $validated['full_name'],
            'role'       => $validated['role'],
            'project'    => $project,
            ...($hasPdProjects ? ['pd_projects' => $pdProjects] : []),
            'is_active'  => true,
            'password'   => null,
            'google_id'  => $sibling?->google_id,
            'avatar_url' => $sibling?->avatar_url,
        ]);

        $this->auditLog($request, 'CREATE_USER', null, $user);

        return response()->json([
            'message' => 'Thêm nhân sự thành công',
            'user'    => [
                'id'          => $user->id,
                'email'       => $user->email,
                'full_name'   => $user->full_name,
                'role'        => $user->role,
                'project'     => $user->project,
                'pd_projects' => $hasPdProjects ? ($user->pd_projects ?? []) : [],
                'is_active'   => true,
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
            'full_name'     => 'sometimes|string|max:255',
            'role'          => ['sometimes', Rule::in(['admin', 'vendor', 'seller', 'pd', 'csf', 'marvel'])],
            'project'       => ['nullable', Rule::in(array_merge(self::$VALID_PROJECTS, [null]))],
            'pd_projects'   => ['sometimes', 'nullable', 'array'],
            'pd_projects.*' => [Rule::in(self::$VALID_PROJECTS)],
        ], [
            'pd_projects.*.in' => 'Project không hợp lệ',
        ]);

        $newRole = $validated['role'] ?? $user->role;
        // PD giữ nguyên project đang có trong DB (không ép về null khi Admin sửa
        // tên) — project của PD không còn dùng để phân quyền, nhưng cũng không
        // có lý do gì để xoá dữ liệu đang có.
        $newRoleKeepsProject = in_array($newRole, ['seller', 'pd']);

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

        $newProject = $newRoleKeepsProject ? ($validated['project'] ?? $user->project) : null;
        // Cột `pd_projects` có thể CHƯA tồn tại nếu deploy code trước khi chạy
        // migrate (xem chú thích ở index()) — update thẳng tên cột không có
        // thật sẽ ném 1054 Unknown column. Thiếu cột thì bỏ qua field này.
        $hasPdProjects = Schema::hasColumn('users', 'pd_projects');
        // Chỉ ghi đè khi role mới là PD; nếu không phải PD, giữ nguyên dữ liệu
        // cũ (tương tự cách xử lý `project` ở trên) — không xoá khi Admin chỉ
        // đổi tên/khoá tài khoản.
        $newPdProjects = $newRole === 'pd'
            ? array_values($validated['pd_projects'] ?? $user->pd_projects ?? [])
            : $user->pd_projects;

        // Không cho đổi thành cặp (email, role, project) đã có ở tài khoản khác.
        $dupQuery = User::where('email', $user->email)
            ->where('role', $newRole)
            ->where('id', '!=', $user->id);
        $newProject !== null ? $dupQuery->where('project', $newProject) : $dupQuery->whereNull('project');
        if ($dupQuery->exists()) {
            return response()->json([
                'message' => 'Đã có tài khoản khác cùng email ở role/project này',
            ], 422);
        }

        $before = $user->only(['full_name', 'role', 'project', 'pd_projects']);

        $user->update([
            'full_name' => $validated['full_name'] ?? $user->full_name,
            'name'      => $validated['full_name'] ?? $user->name,
            'role'      => $newRole,
            'project'   => $newProject,
            ...($hasPdProjects ? ['pd_projects' => $newPdProjects] : []),
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
            'after'     => $target->only(['full_name', 'role', 'project', 'pd_projects', 'is_active']),
            'ip'        => $request->ip(),
            'at'        => now()->toISOString(),
        ]);
    }
}
