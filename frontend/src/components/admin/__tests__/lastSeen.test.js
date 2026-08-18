// ════════════════════════════════════════════════════════
//  Định dạng cột "Lần truy cập cuối".
//
//  Admin đọc cột này để biết tài khoản nào bỏ không — sai định dạng thì khoá
//  nhầm người. Mọi ca đều truyền `now` cố định, không phụ thuộc đồng hồ máy chạy test.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { formatLastSeen } from '../lastSeen';

const NOW = new Date('2026-08-18T10:00:00.000Z');
const ago = (ms) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60 * 1000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

describe('formatLastSeen', () => {
  it('chưa truy cập lần nào', () => {
    [null, undefined, ''].forEach((v) => {
      expect(formatLastSeen(v, NOW)).toEqual({ text: 'Chưa truy cập', stale: true });
    });
  });

  it('mốc rác cũng ra "Chưa truy cập" chứ không phải "Invalid Date"', () => {
    expect(formatLastSeen('khong-phai-ngay', NOW).text).toBe('Chưa truy cập');
  });

  it('dưới 1 phút → "Vừa xong"', () => {
    expect(formatLastSeen(ago(30 * 1000), NOW).text).toBe('Vừa xong');
  });

  it('tính theo phút, giờ, ngày', () => {
    expect(formatLastSeen(ago(5 * MINUTE), NOW).text).toBe('5 phút trước');
    expect(formatLastSeen(ago(59 * MINUTE), NOW).text).toBe('59 phút trước');
    expect(formatLastSeen(ago(2 * HOUR), NOW).text).toBe('2 giờ trước');
    expect(formatLastSeen(ago(23 * HOUR), NOW).text).toBe('23 giờ trước');
    expect(formatLastSeen(ago(3 * DAY), NOW).text).toBe('3 ngày trước');
    expect(formatLastSeen(ago(7 * DAY), NOW).text).toBe('7 ngày trước');
  });

  /** Quá một tuần thì "37 ngày trước" khó hình dung hơn ngày tháng cụ thể. */
  it('quá 7 ngày → hiện ngày tháng', () => {
    const { text } = formatLastSeen(ago(40 * DAY), NOW);

    expect(text).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(text).not.toContain('trước');
  });

  it('quá 30 ngày thì đánh dấu stale để Admin nhận ra', () => {
    expect(formatLastSeen(ago(31 * DAY), NOW).stale).toBe(true);
    expect(formatLastSeen(ago(10 * DAY), NOW).stale).toBe(false);
    expect(formatLastSeen(ago(2 * HOUR), NOW).stale).toBe(false);
  });

  /** Đồng hồ máy chủ nhanh hơn máy trạm → không được hiện "-3 phút trước". */
  it('mốc ở tương lai vẫn hiện "Vừa xong"', () => {
    const future = new Date(NOW.getTime() + 5 * MINUTE).toISOString();

    expect(formatLastSeen(future, NOW).text).toBe('Vừa xong');
  });

  it('ranh giới không nhảy sai đơn vị', () => {
    expect(formatLastSeen(ago(HOUR), NOW).text).toBe('1 giờ trước');
    expect(formatLastSeen(ago(DAY), NOW).text).toBe('1 ngày trước');
  });
});
