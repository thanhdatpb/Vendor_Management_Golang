// ════════════════════════════════════════════════════════
//  MỤC 17 — "Một chỗ duy nhất quyết định cột nào được hiện cho role nào".
//
//  Quy tắc này từng nằm rải rác trong 2 component viewer; mỗi lần đổi phân
//  quyền phải sửa 2 nơi và dễ sót — đó chính là cách lỗi rò rỉ giá phát sinh.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  canSeePrices, normalizeRole, stripPriceFields, currentUserRole,
  isReadOnlyLibraryRole, PRICE_FIELD_KEYS,
  canSeeLeadTime, stripHiddenFields, LEAD_TIME_FIELD_KEYS,
} from '../vendorFieldVisibility';

// Node 22+ có global `localStorage` riêng (chưa bật) che mất bản của jsdom, nên
// trong test không có localStorage thật — dựng bản giả tối thiểu.
const fakeStorage = (initial = {}) => {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('canSeePrices', () => {
  it('role chỉ-đọc không được thấy giá', () => {
    ['csf', 'pd', 'marvel', 'CSF', 'Marvel'].forEach((role) => {
      expect(canSeePrices(role)).toBe(false);
    });
  });

  it('role làm giá vẫn thấy giá, kể cả khi role ghi có gạch dưới hay khoảng trắng', () => {
    ['admin', 'seller', 'vendor', 'staff_a', 'staff_b', 'Staff B'].forEach((role) => {
      expect(canSeePrices(role)).toBe(true);
    });
  });

  it('role lạ hoặc rỗng mặc định KHÔNG thấy giá (danh sách cho phép, không phải danh sách cấm)', () => {
    [null, undefined, '', 'guest', 'intern', 'staff_z'].forEach((role) => {
      expect(canSeePrices(role)).toBe(false);
    });
  });
});

describe('isReadOnlyLibraryRole', () => {
  it('chỉ đúng với 3 role chỉ-đọc đã biết', () => {
    expect(isReadOnlyLibraryRole('csf')).toBe(true);
    expect(isReadOnlyLibraryRole('pd')).toBe(true);
    expect(isReadOnlyLibraryRole('marvel')).toBe(true);
  });

  /**
   * Cố ý KHÁC `!canSeePrices`: user thiếu trường `role` trong localStorage
   * không được coi là role chỉ-đọc, nếu không sẽ bị khoá oan khỏi màn hình.
   */
  it('role rỗng KHÔNG bị coi là role chỉ-đọc', () => {
    expect(isReadOnlyLibraryRole('')).toBe(false);
    expect(canSeePrices('')).toBe(false);
  });
});

describe('normalizeRole', () => {
  it('bỏ gạch dưới, gạch ngang, khoảng trắng và chuyển chữ thường', () => {
    expect(normalizeRole('Staff_B')).toBe('staffb');
    expect(normalizeRole('staff-a')).toBe('staffa');
    expect(normalizeRole('  Seller ')).toBe('seller');
    expect(normalizeRole(null)).toBe('');
  });
});

describe('stripPriceFields', () => {
  const file = () => ({
    filename: 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
    generalInfo: [{ kyHieu: 'VN3', chatLieu: 'Polyester 150gsm', linkFolder: 'https://drive.example/vn3' }],
    pricing: [{
      kyHieu: 'VN3', productType: 'Football Jersey', size: 'S',
      pricing1: 8.2, pricing2: 8.9, eco_price: 4.1, eco_total: 12.3, eco_price_item2: 1.1,
    }],
  });

  it('bỏ sạch khoá giá ở MỌI tầng lồng nhau', () => {
    const stripped = stripPriceFields([file()], 'pd');
    const raw = JSON.stringify(stripped);

    PRICE_FIELD_KEYS.forEach((key) => {
      expect(raw).not.toContain(key);
    });
  });

  it('không làm hỏng việc tra cứu của CSF/PD: chất liệu, size, mã vendor, link vẫn còn', () => {
    const [stripped] = stripPriceFields([file()], 'csf');

    expect(stripped.generalInfo[0].chatLieu).toBe('Polyester 150gsm');
    expect(stripped.generalInfo[0].linkFolder).toBe('https://drive.example/vn3');
    expect(stripped.pricing[0].size).toBe('S');
    expect(stripped.pricing[0].kyHieu).toBe('VN3');
  });

  it('role có quyền nhận nguyên dữ liệu, không tốn công sao chép', () => {
    const files = [file()];

    expect(stripPriceFields(files, 'seller')).toBe(files);
  });

  it('dữ liệu rỗng / null không làm chết component', () => {
    expect(stripPriceFields(null, 'pd')).toBeNull();
    expect(stripPriceFields([], 'pd')).toEqual([]);
  });
});

describe('canSeeLeadTime — 2 cột AVG TG', () => {
  it('CSF VẪN xem được (cần trả lời khách về thời gian giao)', () => {
    expect(canSeeLeadTime('csf')).toBe(true);
  });

  it('PD và Marvel thì không', () => {
    ['pd', 'marvel', 'PD', 'Marvel'].forEach((role) => {
      expect(canSeeLeadTime(role)).toBe(false);
    });
  });

  it('role làm việc vẫn xem được', () => {
    ['admin', 'seller', 'vendor', 'staff_b'].forEach((role) => {
      expect(canSeeLeadTime(role)).toBe(true);
    });
  });

  it('role lạ hoặc rỗng mặc định KHÔNG thấy', () => {
    [null, '', 'guest'].forEach((role) => {
      expect(canSeeLeadTime(role)).toBe(false);
    });
  });

  /** Đây là điểm khác biệt duy nhất giữa CSF và Marvel — chốt lại cho rõ. */
  it('CSF và Marvel chỉ khác nhau đúng ở 2 cột này', () => {
    expect(canSeePrices('csf')).toBe(canSeePrices('marvel'));
    expect(canSeeLeadTime('csf')).not.toBe(canSeeLeadTime('marvel'));
  });
});

describe('stripHiddenFields', () => {
  const file = () => ({
    filename: 'Thu vien P.happy.xlsx',
    generalInfo: [{
      kyHieu: 'VN3', chatLieu: 'Polyester 150gsm', chiTietSize: 'S-M-L',
      avgTimeVendor: 'Thoi gian sx: 3-5 normal days',
      avgTimeActual: 'update sau 3 tuan chay phoi nay',
      notes: 'Ghi chu', linkFolder: 'https://drive.example/vn3',
    }],
    pricing: [{ kyHieu: 'VN3', size: 'S', pricing1: 8.2 }],
  });

  it('PD/Marvel: bỏ cả khoá giá lẫn 2 cột thời gian', () => {
    ['pd', 'marvel'].forEach((role) => {
      const raw = JSON.stringify(stripHiddenFields([file()], role));
      [...PRICE_FIELD_KEYS, ...LEAD_TIME_FIELD_KEYS].forEach((key) => {
        expect(raw).not.toContain(key);
      });
      expect(raw).not.toContain('3-5 normal days');
    });
  });

  it('CSF: bỏ giá nhưng GIỮ 2 cột thời gian', () => {
    const [out] = stripHiddenFields([file()], 'csf');

    expect(out.generalInfo[0].avgTimeVendor).toBe('Thoi gian sx: 3-5 normal days');
    expect(out.generalInfo[0].avgTimeActual).toBe('update sau 3 tuan chay phoi nay');
    expect(JSON.stringify(out)).not.toContain('pricing1');
  });

  it('không làm hỏng phần tra cứu còn lại', () => {
    const [out] = stripHiddenFields([file()], 'pd');

    expect(out.generalInfo[0].chatLieu).toBe('Polyester 150gsm');
    expect(out.generalInfo[0].chiTietSize).toBe('S-M-L');
    expect(out.generalInfo[0].linkFolder).toBe('https://drive.example/vn3');
    expect(out.filename).toBe('Thu vien P.happy.xlsx');
  });

  it('role đủ quyền nhận nguyên dữ liệu, không tốn công sao chép', () => {
    const files = [file()];
    expect(stripHiddenFields(files, 'seller')).toBe(files);
  });
});

describe('currentUserRole', () => {
  it('đọc role từ localStorage như phần còn lại của app', () => {
    vi.stubGlobal('localStorage', fakeStorage({ user: JSON.stringify({ role: 'pd', project: 'happy' }) }));

    expect(currentUserRole()).toBe('pd');
    expect(canSeePrices(currentUserRole())).toBe(false);
  });

  it('localStorage hỏng thì trả rỗng thay vì ném lỗi', () => {
    vi.stubGlobal('localStorage', fakeStorage({ user: '{không phải json' }));

    expect(currentUserRole()).toBe('');
  });

  /** Không có localStorage (SSR / môi trường lạ) cũng không được ném lỗi. */
  it('không có localStorage thì trả rỗng', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(currentUserRole()).toBe('');
  });
});
