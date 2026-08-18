<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Xử lý mốc thời gian `savedAt` của một snapshot bảng tính giá.
 *
 * Client gửi ISO-8601 do `new Date().toISOString()` sinh ra — dạng
 * `2026-08-18T07:52:00.123Z`. Ghi thẳng chuỗi đó vào cột `saved_at` kiểu
 * `timestamp` thì:
 *   • SQLite  — nhận, vì cột chỉ có type affinity, không kiểm gì. Test xanh.
 *   • MySQL   — hậu tố `Z` không phải định dạng offset hợp lệ. Với `strict`
 *               (config/database.php bật sẵn) sẽ ném `1292 Incorrect datetime
 *               value` → lần Lưu đầu tiên sau deploy trả 500, và command
 *               backfill chết ngay bảng đầu tiên có lịch sử.
 *
 * Nên mọi giá trị đi vào cột đều phải qua `column()`. Gom vào một chỗ vì cả
 * PriceSheetController lẫn BackfillPriceSheetVersions đều ghi bảng này — sửa
 * hai nơi là cách để một nơi bị bỏ sót.
 */
final class SnapshotTime
{
    private const DB_FORMAT = 'Y-m-d H:i:s';

    /**
     * Khoá so trùng. `saved_at` đọc từ DB ra dạng "Y-m-d H:i:s" còn client gửi
     * ISO-8601 — quy cả hai về một dạng để nhận ra cùng một lần lưu.
     *
     * Chuỗi không parse được thì giữ nguyên: nó vẫn là khoá so sánh hợp lệ,
     * chỉ là không gộp được với dạng khác của cùng mốc thời gian.
     */
    public static function key(string $raw): string
    {
        return self::parse($raw)?->format(self::DB_FORMAT) ?? $raw;
    }

    /**
     * Giá trị ghi vào cột `saved_at`. Luôn là datetime hợp lệ — chuỗi rác hoặc
     * rỗng thì lấy thời điểm hiện tại, vì mất một mốc thời gian chính xác vẫn
     * hơn là làm hỏng cả lần lưu.
     */
    public static function column(string $raw): string
    {
        return (self::parse($raw) ?? Carbon::now())->format(self::DB_FORMAT);
    }

    private static function parse(string $raw): ?Carbon
    {
        if (trim($raw) === '') {
            return null;
        }

        // Sàng bằng strtotime trước: `Carbon::parse` với chuỗi rác vừa ném
        // exception vừa phát E_WARNING, và PHPUnit đánh dấu test là "warning"
        // dù đã catch. strtotime trả false lặng lẽ.
        if (strtotime($raw) === false) {
            return null;
        }

        try {
            // App chạy timezone UTC (config/app.php) nên quy về UTC là khớp với
            // mọi mốc thời gian khác Laravel tự ghi.
            return Carbon::parse($raw)->utc();
        } catch (\Throwable $e) {
            return null;
        }
    }
}
