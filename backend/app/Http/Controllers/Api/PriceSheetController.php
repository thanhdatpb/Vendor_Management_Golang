<?php

namespace App\Http\Controllers\Api;

use App\Events\PriceSheetChanged;
use App\Http\Controllers\Controller;
use App\Support\PriceSheetSummary;
use App\Support\SnapshotTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Lưu trữ "Bảng tính giá" (Setup Price) trên server, chia sẻ theo project.
 * Mỗi bảng = 1 dòng trong bảng price_sheets, nội dung đầy đủ nằm ở cột JSON `data`.
 * Filter theo project ngay ở server để không lộ giá của project khác.
 *
 * Phân tầng payload (mục 17):
 *   GET /price-sheets            → CHỈ các cột tổng hợp (không đụng blob)
 *   GET /price-sheets/{id}       → nội dung đầy đủ, KHÔNG kèm lịch sử
 *   GET /price-sheets/{id}/versions → lịch sử, nạp lazy khi mở panel Lịch sử
 */
class PriceSheetController extends Controller
{
    /** Số phiên bản giữ lại cho mỗi bảng — giữ đúng giới hạn 20 như bản cũ. */
    private const MAX_VERSIONS = 20;

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

    // ── Cache theo version (cùng pattern với products/vendors) ────────────────

    private function cacheVersion(): string
    {
        return 'v' . Cache::get('price_sheets_cache_version', 0);
    }

    private function bumpCacheVersion(): void
    {
        // `Cache::increment` của database store trả false và KHÔNG tạo key khi
        // key chưa tồn tại (Illuminate\Cache\DatabaseStore::incrementOrDecrement).
        // Không seed trước thì version kẹt ở 0 vĩnh viễn → danh sách phục vụ bản
        // cache cũ tới 1 giờ sau khi Seller lưu, và tín hiệu realtime của mục 16
        // trở nên vô nghĩa vì client refetch vẫn nhận đúng bản cũ đó.
        //
        // File/Redis store tự tạo key nên lỗi này KHÔNG lộ ra khi chạy test
        // (test dùng array store) — chỉ lộ trên production.
        Cache::add('price_sheets_cache_version', 0);
        Cache::increment('price_sheets_cache_version');
    }

    /**
     * Danh sách bảng tính giá — CHỈ cột tổng hợp.
     *
     * Bản cũ `json_decode` nguyên cột `data` của mọi dòng, tức là tải 21 bản sao
     * nội dung mỗi bảng (bản hiện hành + 20 bản history) chỉ để hiện tên, vendor,
     * số size, khoảng giá, avg margin. Giờ các con số đó là cột thật, tính sẵn
     * lúc lưu (xem PriceSheetSummary).
     */
    public function index(Request $request)
    {
        $user  = $request->user();
        $scope = $this->seesAllProjects($user) ? '*' : $this->projectKey($user);

        // ── Vì sao phải có cờ `summary` ────────────────────────────────────
        // Bản rút gọn KHÔNG có `settings`/`productTypes`. Client cũ (bundle còn
        // nằm trong cache trình duyệt sau khi deploy backend) mở workspace bằng
        // chính object trong danh sách — nhận bản rút gọn thì workspace hiện ra
        // bảng TRỐNG, và chỉ cần người dùng bấm Lưu là bảng giá thật bị ghi đè
        // bằng bảng rỗng. Mất dữ liệu, không có cảnh báo nào.
        //
        // Nên bản rút gọn chỉ trả cho client nói rõ là mình hiểu nó. Khi toàn
        // bộ người dùng đã lên bundle mới thì bỏ nhánh này đi.
        if (!$request->boolean('summary')) {
            return $this->legacyIndex($scope);
        }

        $sheets = Cache::remember(
            'price_sheets_index_' . $this->cacheVersion() . '_' . md5($scope),
            3600,
            function () use ($scope) {
                $query = DB::table('price_sheets')
                    ->select([
                        'id', 'project', 'name', 'version', 'vendor_ref', 'source_file',
                        'product_type_names', 'size_count', 'min_price', 'max_price',
                        'avg_margin', 'updated_by', 'created_at', 'updated_at',
                    ])
                    ->orderBy('updated_at', 'desc');

                if ($scope !== '*') {
                    $query->where(function ($q) use ($scope) {
                        $q->whereNull('project')->orWhere('project', $scope);
                    });
                }

                return $query->get()
                    ->map(fn ($row) => $this->summaryPayload($this->hydrateSummary($row)))
                    ->values()
                    ->all();
            }
        );

        return response()->json($sheets);
    }

    /**
     * Hành vi CŨ: trả nguyên nội dung từng bảng.
     *
     * Giữ lại đúng nguyên trạng để client chưa cập nhật vẫn chạy như trước
     * trong lúc bundle mới lan ra. Đây là nhánh sẽ xoá, không phải nhánh để
     * phát triển thêm.
     */
    private function legacyIndex(string $scope)
    {
        $query = DB::table('price_sheets')->orderBy('updated_at', 'desc');
        if ($scope !== '*') {
            $query->where(function ($q) use ($scope) {
                $q->whereNull('project')->orWhere('project', $scope);
            });
        }

        $sheets = $query->get()->map(function ($row) {
            $sheet = json_decode($row->data, true);
            if (!is_array($sheet)) {
                return null;
            }
            // Version là của server, không phải của blob — luôn ghi đè để client
            // nhận đúng số hiện hành mà gửi lại khi lưu.
            $sheet['version'] = (int) ($row->version ?? 1);

            return $sheet;
        })->filter()->values();

        return response()->json($sheets);
    }

    /** Nội dung đầy đủ của một bảng — chỉ gọi khi bấm "Mở bảng". */
    public function show(Request $request, string $id)
    {
        $row = DB::table('price_sheets')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['message' => 'Không tìm thấy bảng tính giá.'], 404);
        }
        if (!$this->canAccess($request->user(), $row)) {
            return response()->json(['message' => 'Bạn không có quyền xem bảng này.'], 403);
        }

        $sheet = json_decode($row->data, true);
        if (!is_array($sheet)) {
            return response()->json(['message' => 'Dữ liệu bảng tính giá không hợp lệ.'], 422);
        }

        // Lịch sử nạp riêng qua /versions — không gửi kèm ở đây.
        $blobHistory = is_array($sheet['history'] ?? null) ? $sheet['history'] : [];
        unset($sheet['history']);

        $stored = (int) DB::table('price_sheet_versions')->where('sheet_id', $id)->count();

        $sheet['version']      = (int) ($row->version ?? 1);
        $sheet['historyCount'] = $stored > 0 ? $stored : count($blobHistory);

        return response()->json($sheet);
    }

    /**
     * Lịch sử phiên bản, mới nhất trước.
     *
     * Bảng chưa backfill thì đọc thẳng `history` trong blob — người dùng vẫn thấy
     * đủ lịch sử ngay sau khi deploy, không phải chờ chạy command.
     */
    public function versions(Request $request, string $id)
    {
        $row = DB::table('price_sheets')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['message' => 'Không tìm thấy bảng tính giá.'], 404);
        }
        if (!$this->canAccess($request->user(), $row)) {
            return response()->json(['message' => 'Bạn không có quyền xem bảng này.'], 403);
        }

        $rows = DB::table('price_sheet_versions')
            ->where('sheet_id', $id)
            ->orderBy('version', 'desc')
            ->get();

        if ($rows->isEmpty()) {
            $sheet = json_decode($row->data, true);
            $blob  = is_array($sheet['history'] ?? null) ? $sheet['history'] : [];

            return response()->json(array_values($blob));
        }

        return response()->json($rows->map(function ($version) {
            $snapshot = json_decode($version->data, true);
            $snapshot = is_array($snapshot) ? $snapshot : [];

            return array_merge($snapshot, [
                'version' => (int) $version->version,
                'savedAt' => $version->saved_at,
                'savedBy' => $version->saved_by,
            ]);
        })->all());
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

        $existing = DB::table('price_sheets')->where('id', $sheet['id'])->first();

        // ── Chống ghi đè mất dữ liệu (mục 16) ───────────────────────────────
        // Client mới gửi kèm `expectedVersion` = version nó đọc được lúc mở
        // bảng. Lệch nghĩa là có người khác đã lưu ở giữa → trả 409 kèm bản
        // hiện hành để người dùng tự quyết, thay vì âm thầm xoá công của họ.
        //
        // Client CŨ không gửi trường này: giữ nguyên hành vi cũ để deploy
        // backend trước frontend không làm hỏng ai. `force` là lối thoát khi
        // người dùng đã xem cảnh báo và cố ý ghi đè.
        $expectedVersion = $request->input('expectedVersion');
        $force           = filter_var($request->input('force', false), FILTER_VALIDATE_BOOLEAN);

        if ($existing && $expectedVersion !== null && !$force) {
            $currentVersion = (int) ($existing->version ?? 1);
            if ((int) $expectedVersion !== $currentVersion) {
                $currentSheet = json_decode($existing->data, true);
                if (is_array($currentSheet)) {
                    $currentSheet['version'] = $currentVersion;
                }

                return response()->json([
                    'message'        => 'Bảng tính giá này đã được người khác cập nhật.',
                    'code'           => 'version_conflict',
                    'currentVersion' => $currentVersion,
                    'updatedBy'      => $this->lastEditorOf($currentSheet, $sheet['id']),
                    'updatedAt'      => $existing->updated_at,
                    'current'        => $currentSheet,
                ], 409);
            }
        }

        // ── Lịch sử: ra bảng riêng, không nhét thêm vào blob (mục 17) ────────
        // Client gửi lên snapshot mới (bản cũ gửi cả 20 — cả hai đều xử được vì
        // storeVersions khử trùng theo savedAt).
        $incomingHistory = is_array($sheet['history'] ?? null) ? $sheet['history'] : [];
        unset($sheet['history']);

        // `history` cũ trong blob giữ NGUYÊN như đang có — đường lùi nếu phải
        // rollback bản deploy này. Nó không lớn thêm nữa vì snapshot mới đi
        // đường khác.
        if ($existing) {
            $old = json_decode($existing->data, true);
            if (is_array($old) && !empty($old['history'])) {
                $sheet['history'] = $old['history'];
            }
        }

        $nextVersion = $existing ? ((int) ($existing->version ?? 1)) + 1 : 1;
        // Đồng bộ version vào blob để export/clone mang đúng số.
        $sheet['version'] = $nextVersion;

        $payload = array_merge(PriceSheetSummary::summaryColumns($sheet), [
            'project'    => $project,
            'name'       => $sheet['name'] ?? null,
            'version'    => $nextVersion,
            'updated_by' => (string) ($user->name ?? '') ?: null,
            'data'       => json_encode($sheet, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ]);

        if ($existing) {
            DB::table('price_sheets')->where('id', $sheet['id'])->update($payload);
        } else {
            DB::table('price_sheets')->insert(array_merge($payload, [
                'id'         => $sheet['id'],
                'created_at' => now(),
            ]));
        }

        $this->storeVersions((string) $sheet['id'], $incomingHistory);
        $this->bumpCacheVersion();

        $this->announce($sheet['id'], 'saved', $nextVersion, $user, $project);

        return response()->json([
            'message' => 'Đã lưu bảng tính giá',
            'id'      => $sheet['id'],
            'version' => $nextVersion,
        ]);
    }

    /**
     * Ghi các snapshot mới vào bảng lịch sử.
     *
     * Khử trùng theo `savedAt` để client cũ (gửi cả 20 bản mỗi lần lưu) không
     * tạo ra bản sao — lần lưu đầu tiên của bảng cũ chính là một lần backfill.
     */
    private function storeVersions(string $sheetId, array $snapshots): void
    {
        if ($snapshots === []) {
            return;
        }

        $existingKeys = array_flip(
            DB::table('price_sheet_versions')
                ->where('sheet_id', $sheetId)
                ->pluck('saved_at')
                ->filter()
                ->map(fn ($value) => SnapshotTime::key((string) $value))
                ->all()
        );

        $nextVersion = (int) DB::table('price_sheet_versions')->where('sheet_id', $sheetId)->max('version');

        // Client gửi mới-nhất-trước; ghi theo thứ tự thời gian để số version tăng dần.
        foreach (array_reverse($snapshots) as $snapshot) {
            if (!is_array($snapshot)) {
                continue;
            }

            $savedAt = (string) ($snapshot['savedAt'] ?? '');
            $key     = SnapshotTime::key($savedAt);
            if ($savedAt !== '' && isset($existingKeys[$key])) {
                continue;
            }

            $nextVersion++;
            DB::table('price_sheet_versions')->insert([
                'sheet_id'   => $sheetId,
                'version'    => $nextVersion,
                // KHÔNG ghi thẳng chuỗi client gửi: ISO-8601 kèm hậu tố `Z` làm
                // MySQL strict ném 1292, còn SQLite thì nhận nên test không thấy.
                'saved_at'   => SnapshotTime::column($savedAt),
                'saved_by'   => $snapshot['savedBy'] ?? null,
                'data'       => json_encode($snapshot, JSON_UNESCAPED_UNICODE),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($savedAt !== '') {
                $existingKeys[$key] = true;
            }
        }

        $this->pruneVersions($sheetId);
    }

    /** Giữ đúng MAX_VERSIONS bản mới nhất cho mỗi bảng. */
    private function pruneVersions(string $sheetId): void
    {
        $keep = DB::table('price_sheet_versions')
            ->where('sheet_id', $sheetId)
            ->orderBy('version', 'desc')
            ->limit(self::MAX_VERSIONS)
            ->pluck('id')
            ->all();

        if ($keep === []) {
            return;
        }

        DB::table('price_sheet_versions')
            ->where('sheet_id', $sheetId)
            ->whereNotIn('id', $keep)
            ->delete();
    }

    /**
     * Bảng cũ (lưu trước khi có các cột tổng hợp) thì tính một lần rồi ghi lại.
     *
     * Command `pricesheets:backfill-versions` làm việc này hàng loạt lúc deploy;
     * hàm này là lưới an toàn cho dòng bị sót — và nó chỉ đọc blob ĐÚNG MỘT LẦN
     * cho mỗi bảng, không phải mỗi lần mở danh sách như bản cũ.
     *
     * `product_type_names` là cờ "đã tổng hợp": luôn được ghi (kể cả mảng rỗng)
     * nên bảng thật sự không có size cũng không bị tính đi tính lại.
     */
    private function hydrateSummary($row)
    {
        if ($row->product_type_names !== null) {
            return $row;
        }

        $full = DB::table('price_sheets')->where('id', $row->id)->value('data');
        $sheet = json_decode((string) $full, true);
        if (!is_array($sheet)) {
            $sheet = [];
        }

        $columns = PriceSheetSummary::summaryColumns($sheet);

        // Không đụng `updated_at`: đây là bù dữ liệu, không phải người dùng sửa bảng.
        DB::table('price_sheets')->where('id', $row->id)->update($columns);

        foreach ($columns as $column => $value) {
            $row->{$column} = $value;
        }

        return $row;
    }

    /** Người dùng có được đụng vào bảng này không (theo project). */
    private function canAccess($user, $row): bool
    {
        if ($this->seesAllProjects($user)) {
            return true;
        }

        return !$row->project || $row->project === $this->projectKey($user);
    }

    /** Một dòng danh sách — chỉ số liệu tổng hợp, không có nội dung bảng. */
    private function summaryPayload($row): array
    {
        $names = json_decode((string) $row->product_type_names, true);

        return [
            'id'               => $row->id,
            'name'             => $row->name,
            'project'          => $row->project,
            'version'          => (int) ($row->version ?? 1),
            'vendorRef'        => $row->vendor_ref,
            '_sourceFile'      => $row->source_file,
            'productTypeNames' => is_array($names) ? $names : [],
            'sizeCount'        => (int) $row->size_count,
            'minPrice'         => $row->min_price === null ? null : (float) $row->min_price,
            'maxPrice'         => $row->max_price === null ? null : (float) $row->max_price,
            'avgMargin'        => $row->avg_margin === null ? null : (float) $row->avg_margin,
            'updatedBy'        => $row->updated_by,
            'createdAt'        => $row->created_at,
            'updatedAt'        => $row->updated_at,
            // Cờ để client biết đây là bản rút gọn, phải gọi /price-sheets/{id}
            // trước khi mở workspace.
            '_summary'         => true,
        ];
    }

    /** Tên người lưu gần nhất — ưu tiên bảng lịch sử, sau đó tới blob cũ. */
    private function lastEditorOf($sheet, string $sheetId): string
    {
        $latest = DB::table('price_sheet_versions')
            ->where('sheet_id', $sheetId)
            ->orderBy('version', 'desc')
            ->value('saved_by');

        if (!is_string($latest) || $latest === '') {
            $latest = $sheet['history'][0]['savedBy'] ?? null;
        }

        return is_string($latest) && $latest !== '' ? $latest : 'người khác';
    }

    /**
     * Phát tín hiệu cho các máy khác trong project. Lỗi broadcast KHÔNG được
     * làm hỏng thao tác lưu — dữ liệu đã ghi xong, cùng lắm là người khác phải
     * chờ tới lần refetch kế tiếp.
     */
    private function announce(string $sheetId, string $action, int $version, $user, ?string $project): void
    {
        try {
            broadcast(new PriceSheetChanged(
                $sheetId,
                $action,
                $version,
                (string) ($user->name ?? 'Ai đó'),
                $project
            ));
        } catch (\Throwable $e) {
            Log::warning('Không broadcast được thay đổi bảng tính giá.', [
                'sheet_id' => $sheetId,
                'action'   => $action,
                'error'    => $e->getMessage(),
            ]);
        }
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();

        $row = DB::table('price_sheets')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['message' => 'Không tìm thấy bảng tính giá.'], 404);
        }
        if (!$this->canAccess($user, $row)) {
            return response()->json(['message' => 'Bạn không có quyền xoá bảng này.'], 403);
        }

        DB::table('price_sheets')->where('id', $id)->delete();
        DB::table('price_sheet_versions')->where('sheet_id', $id)->delete();
        $this->bumpCacheVersion();

        $this->announce($id, 'deleted', (int) ($row->version ?? 1), $user, $row->project);

        return response()->json(['message' => 'Đã xoá bảng tính giá']);
    }
}
