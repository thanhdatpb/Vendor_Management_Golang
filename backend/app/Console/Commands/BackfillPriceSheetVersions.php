<?php

namespace App\Console\Commands;

use App\Support\PriceSheetSummary;
use App\Support\SnapshotTime;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Chuyển lịch sử phiên bản từ blob `price_sheets.data` sang bảng
 * `price_sheet_versions`, và điền các cột tổng hợp cho bảng cũ (mục 17).
 *
 * KHÔNG xoá `history` trong blob — đó là đường lùi nếu phải rollback bản deploy
 * này. Chạy lại nhiều lần cũng an toàn: snapshot đã có (so theo `savedAt`) thì bỏ qua.
 */
class BackfillPriceSheetVersions extends Command
{
    protected $signature = 'pricesheets:backfill-versions
                            {--dry-run : Chỉ in ra sẽ làm gì, không ghi DB}';

    protected $description = 'Backfill lịch sử bảng tính giá sang price_sheet_versions và điền cột tổng hợp';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $sheets   = DB::table('price_sheets')->get();
        $inserted = 0;
        $updated  = 0;

        foreach ($sheets as $row) {
            $sheet = json_decode($row->data, true);
            if (!is_array($sheet)) {
                $this->warn("Bỏ qua {$row->id}: cột data không phải JSON hợp lệ.");
                continue;
            }

            $inserted += $this->backfillHistory((string) $row->id, $sheet, $dryRun);

            if ($this->backfillSummary($row, $sheet, $dryRun)) {
                $updated++;
            }
        }

        if (!$dryRun && ($inserted > 0 || $updated > 0)) {
            // Danh sách đang được cache theo version — bump để lần gọi kế tiếp
            // đọc lại các cột tổng hợp vừa điền.
            //
            // `add` trước `increment`: store `database` KHÔNG tạo key khi key
            // chưa có, increment trả false và version kẹt ở 0 vĩnh viễn.
            Cache::add('price_sheets_cache_version', 0);
            Cache::increment('price_sheets_cache_version');
        }

        $prefix = $dryRun ? '[dry-run] ' : '';
        $this->info("{$prefix}Đã thêm {$inserted} phiên bản, cập nhật tổng hợp cho {$updated} bảng.");

        return self::SUCCESS;
    }

    /** @param array<string,mixed> $sheet */
    private function backfillHistory(string $sheetId, array $sheet, bool $dryRun): int
    {
        $history = is_array($sheet['history'] ?? null) ? $sheet['history'] : [];
        if ($history === []) {
            return 0;
        }

        $existing = DB::table('price_sheet_versions')
            ->where('sheet_id', $sheetId)
            ->pluck('saved_at')
            ->filter()
            ->map(fn ($value) => SnapshotTime::key((string) $value))
            ->all();
        $existing = array_flip($existing);

        $nextVersion = (int) DB::table('price_sheet_versions')->where('sheet_id', $sheetId)->max('version');
        $inserted    = 0;

        // `history` lưu mới-nhất-trước → đảo lại để version tăng theo thời gian.
        foreach (array_reverse($history) as $snapshot) {
            if (!is_array($snapshot)) {
                continue;
            }

            $savedAt = (string) ($snapshot['savedAt'] ?? '');
            $key     = SnapshotTime::key($savedAt);
            if ($savedAt !== '' && isset($existing[$key])) {
                continue;
            }

            $nextVersion++;
            $inserted++;

            if ($dryRun) {
                continue;
            }

            DB::table('price_sheet_versions')->insert([
                'sheet_id'   => $sheetId,
                'version'    => $nextVersion,
                // Chuỗi ISO-8601 của client không ghi thẳng vào cột datetime
                // được — xem App\Support\SnapshotTime.
                'saved_at'   => SnapshotTime::column($savedAt),
                'saved_by'   => $snapshot['savedBy'] ?? null,
                'data'       => json_encode($snapshot, JSON_UNESCAPED_UNICODE),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($savedAt !== '') {
                $existing[$key] = true;
            }
        }

        return $inserted;
    }

    /** @param array<string,mixed> $sheet */
    private function backfillSummary($row, array $sheet, bool $dryRun): bool
    {
        // Bảng đã có số tổng hợp (được lưu lại sau khi deploy) thì không đụng.
        if ((int) ($row->size_count ?? 0) > 0) {
            return false;
        }

        $summary = PriceSheetSummary::summarize($sheet);
        if ($summary['count'] === 0) {
            return false;
        }

        if ($dryRun) {
            return true;
        }

        DB::table('price_sheets')->where('id', $row->id)
            ->update(PriceSheetSummary::summaryColumns($sheet));

        return true;
    }

}
