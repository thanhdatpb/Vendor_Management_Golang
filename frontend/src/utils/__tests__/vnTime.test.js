import { describe, it, expect } from 'vitest';
import {
  toDate, timeValue, fmtVNDate, fmtVNDateTime, fmtVNDateTimeShort, fmtVNLongDate,
  vnDateStamp, vnIsoDate, vnFileStamp, vnStartOfWeek,
} from '../vnTime';

describe('vnTime', () => {
  it('đọc chuỗi DB không offset ("Y-m-d H:i:s") là UTC, không phải giờ máy', () => {
    // Backend trả thẳng cột saved_at qua Query Builder → không có hậu tố Z.
    expect(toDate('2026-08-24 06:27:12').toISOString()).toBe('2026-08-24T06:27:12.000Z');
  });

  it('giữ nguyên mốc với ISO có Z', () => {
    expect(toDate('2026-08-24T06:27:12.345Z').toISOString()).toBe('2026-08-24T06:27:12.345Z');
  });

  it('tôn trọng offset đã ghi rõ trong chuỗi', () => {
    expect(toDate('2026-08-24T13:27:12+07:00').toISOString()).toBe('2026-08-24T06:27:12.000Z');
  });

  it('giá trị rỗng / rác trả null', () => {
    for (const bad of [null, undefined, '', '   ', 'không-phải-ngày', {}]) {
      expect(toDate(bad)).toBeNull();
    }
  });

  it('hiển thị 06:27 UTC thành 13:27 giờ Việt Nam', () => {
    const out = fmtVNDateTime('2026-08-24 06:27:12');
    expect(out).toContain('13:27:12');
    expect(out).toContain('24/8/2026');
  });

  it('cộng đủ 7 tiếng nên mốc gần nửa đêm UTC nhảy sang ngày hôm sau', () => {
    expect(fmtVNDate('2026-08-24 18:00:00')).toBe('25/8/2026');
  });

  it('trả fallback khi không đọc được', () => {
    expect(fmtVNDateTime('', '—')).toBe('—');
    expect(fmtVNDate(null, '—')).toBe('—');
  });

  it('timeValue cho ms để sắp xếp, có fallback riêng', () => {
    expect(timeValue('2026-08-24 06:27:12')).toBe(Date.UTC(2026, 7, 24, 6, 27, 12));
    expect(timeValue('rác')).toBe(0);
    expect(timeValue(null, NaN)).toBeNaN();
  });

  it('fmtVNDateTimeShort bỏ giây, vẫn theo giờ VN', () => {
    expect(fmtVNDateTimeShort('2026-08-24 06:27:12')).toBe('13:27 24/08/2026');
  });

  it('fmtVNLongDate lấy thứ theo lịch VN', () => {
    // 18:00 UTC ngày 24/8 = 01:00 ngày 25/8 ở VN → phải là thứ Ba, không phải thứ Hai.
    expect(fmtVNLongDate('2026-08-24 18:00:00')).toBe('Thứ Ba, 25 tháng 8, 2026');
  });

  it('dấu ngày cho tên file lấy ngày VN, không lấy ngày UTC', () => {
    expect(vnDateStamp('2026-08-24T18:00:00Z')).toBe('25-08-2026');
    expect(vnDateStamp('2026-08-24T18:00:00Z', '/')).toBe('25/08/2026');
    expect(vnIsoDate('2026-08-24T18:00:00Z')).toBe('2026-08-25');
    expect(vnFileStamp('2026-08-24T06:27:12Z')).toBe('2026-08-24T13-27-12');
  });

  describe('vnStartOfWeek — mốc thứ Hai 00:00 giờ VN', () => {
    const iso = (v) => new Date(vnStartOfWeek(v)).toISOString();

    it('giữa tuần lùi về thứ Hai cùng tuần', () => {
      expect(iso('2026-08-24 06:27:12')).toBe('2026-08-23T17:00:00.000Z');
    });

    it('chủ nhật lùi 6 ngày, không nhảy sang tuần sau', () => {
      // 16:59 UTC CN 23/8 = 23:59 CN ở VN → vẫn thuộc tuần bắt đầu 17/8.
      expect(iso('2026-08-23T16:59:00Z')).toBe('2026-08-16T17:00:00.000Z');
    });

    it('qua nửa đêm VN là sang tuần mới dù UTC vẫn là chủ nhật', () => {
      // 20:00 UTC CN 30/8 = 03:00 thứ Hai 31/8 ở VN.
      expect(iso('2026-08-30T20:00:00Z')).toBe('2026-08-30T17:00:00.000Z');
    });
  });
});
