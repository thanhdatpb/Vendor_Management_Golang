<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Lưu trữ "Bảng tính giá" (Setup Price) trên server, chia sẻ theo project.
 * Mỗi bảng = 1 dòng trong bảng price_sheets, nội dung đầy đủ nằm ở cột JSON `data`.
 * Filter theo project ngay ở server để không lộ giá của project khác.
 */
class PriceSheetController extends Controller
{
    /** Chuẩn hoá role: bỏ dấu _/-/space, chữ thường. */
    private function normRole($role): string
    {
        return strtolower(preg_replace('/[_\-\s]/', '', (string) $role));
    }

    /** Role được xem tất cả project (khớp _getUserProjectKey ở frontend). */
    private function seesAllProjects($user): bool
    {
        return in_array($this->normRole($user->role ?? ''), ['admin', 'marvel', 'staffb', 'vendor'], true);
    }

    private function projectKey($user): string
    {
        return strtolower(trim((string) ($user->project ?? '')));
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = DB::table('price_sheets')->orderBy('updated_at', 'desc');
        if (!$this->seesAllProjects($user)) {
            $key = $this->projectKey($user);
            $query->where(function ($q) use ($key) {
                $q->whereNull('project')->orWhere('project', $key);
            });
        }

        $rows = $query->get();
        $sheets = $rows->map(function ($row) {
            $sheet = json_decode($row->data, true);
            return is_array($sheet) ? $sheet : null;
        })->filter()->values();

        return response()->json($sheets);
    }

    public function upsert(Request $request)
    {
        $user  = $request->user();
        $sheet = $request->all();

        if (empty($sheet['id'])) {
            return response()->json(['message' => 'Thiếu id bảng tính giá.'], 422);
        }

        // Không cho seller ghi vào project khác của mình
        $project = $sheet['project'] ?? null;
        if (!$this->seesAllProjects($user)) {
            $project = $this->projectKey($user);
            $sheet['project'] = $project;
        }

        $payload = [
            'project'    => $project,
            'name'       => $sheet['name'] ?? null,
            'data'       => json_encode($sheet, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ];

        $exists = DB::table('price_sheets')->where('id', $sheet['id'])->exists();
        if ($exists) {
            DB::table('price_sheets')->where('id', $sheet['id'])->update($payload);
        } else {
            DB::table('price_sheets')->insert(array_merge($payload, [
                'id'         => $sheet['id'],
                'created_at' => now(),
            ]));
        }

        return response()->json(['message' => 'Đã lưu bảng tính giá', 'id' => $sheet['id']]);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();

        $row = DB::table('price_sheets')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['message' => 'Không tìm thấy bảng tính giá.'], 404);
        }
        if (!$this->seesAllProjects($user) && $row->project && $row->project !== $this->projectKey($user)) {
            return response()->json(['message' => 'Bạn không có quyền xoá bảng này.'], 403);
        }

        DB::table('price_sheets')->where('id', $id)->delete();
        return response()->json(['message' => 'Đã xoá bảng tính giá']);
    }
}
