<?php

namespace Tests\Unit;

use App\Support\SnapshotTime;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

/**
 * Mục 17 — mốc thời gian của snapshot phải ghi được vào cột datetime của MySQL.
 *
 * Bộ test chạy trên SQLite, mà SQLite nhận mọi chuỗi vào cột `timestamp` (chỉ
 * có type affinity). Nên lớp lỗi này KHÔNG thể bắt bằng test tích hợp trên
 * SQLite — phải chốt ngay ở đây, tại chỗ sinh ra giá trị.
 */
#[Group('milestone-d')]
class SnapshotTimeTest extends TestCase
{
    /**
     * Đúng chuỗi mà `new Date().toISOString()` của trình duyệt sinh ra.
     * Hậu tố `Z` không phải định dạng offset MySQL chấp nhận → strict mode ném
     * `1292 Incorrect datetime value`.
     */
    public function test_iso_8601_cua_trinh_duyet_thanh_datetime_mysql_nhan_duoc(): void
    {
        $this->assertSame(
            '2026-08-18 07:52:00',
            SnapshotTime::column('2026-08-18T07:52:00.123Z')
        );
    }

    public function test_moi_dang_iso_deu_quy_ve_utc(): void
    {
        // Cùng một mốc thời gian, ba cách viết.
        foreach (['2026-08-18T07:52:00Z', '2026-08-18T14:52:00+07:00', '2026-08-18T07:52:00+00:00'] as $raw) {
            $this->assertSame('2026-08-18 07:52:00', SnapshotTime::column($raw), $raw);
        }
    }

    public function test_khong_con_ky_tu_nao_ngoai_dinh_dang_datetime(): void
    {
        $value = SnapshotTime::column('2026-08-18T07:52:00.123Z');

        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $value);
        $this->assertStringNotContainsString('T', $value);
        $this->assertStringNotContainsString('Z', $value);
    }

    /**
     * Chuỗi rác không được phép làm hỏng cả lần lưu — mất một mốc thời gian
     * chính xác vẫn hơn mất cả bảng giá.
     */
    public function test_chuoi_rac_hoac_rong_van_ra_datetime_hop_le(): void
    {
        foreach (['', '   ', 'khong-phai-ngay'] as $raw) {
            $this->assertMatchesRegularExpression(
                '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/',
                SnapshotTime::column($raw),
                var_export($raw, true)
            );
        }
    }

    /** Khoá so trùng phải nhận ra cùng một lần lưu dù đọc từ DB hay từ client. */
    public function test_key_nhan_ra_cung_mot_moc_du_khac_dinh_dang(): void
    {
        $fromClient = SnapshotTime::key('2026-08-18T07:52:00.123Z');
        $fromDb     = SnapshotTime::key('2026-08-18 07:52:00');

        $this->assertSame($fromClient, $fromDb);
    }

    /** Không parse được thì giữ nguyên — vẫn là khoá so sánh dùng được. */
    public function test_key_giu_nguyen_chuoi_khong_parse_duoc(): void
    {
        $this->assertSame('khong-phai-ngay', SnapshotTime::key('khong-phai-ngay'));
    }
}
