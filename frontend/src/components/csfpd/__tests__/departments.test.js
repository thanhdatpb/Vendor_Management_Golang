// ════════════════════════════════════════════════════════
//  Khai báo theo bộ phận không được lệch khỏi quy tắc phân quyền.
//
//  `departments.js` là thứ dựng giao diện; `vendorFieldVisibility.js` là thứ
//  quyết định trường nào được phép tồn tại. Hai file, hai mục đích — nhưng lệch
//  nhau là ra đúng một trong hai lỗi:
//    • khai báo rộng hơn quyền → cột hiện lên rỗng, người dùng tưởng mất dữ liệu
//    • khai báo hẹp hơn quyền → giấu mất thứ bộ phận đó được xem
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { DEPARTMENTS, departmentFor } from '../departments';
import { canSeePrices, canSeeLeadTime } from '../../../constants/vendorFieldVisibility';

describe('DEPARTMENTS khớp với quy tắc phân quyền', () => {
  it.each(Object.values(DEPARTMENTS))('$label: khai báo khớp quyền thật', (dept) => {
    expect(dept.showPrices).toBe(canSeePrices(dept.key));
    expect(dept.showLeadTime).toBe(canSeeLeadTime(dept.key));
  });

  it('không bộ phận nào trong nhóm này được xem giá', () => {
    Object.values(DEPARTMENTS).forEach((dept) => {
      expect(dept.showPrices).toBe(false);
    });
  });

  it('chỉ CSF thấy 2 cột thời gian', () => {
    expect(DEPARTMENTS.csf.showLeadTime).toBe(true);
    expect(DEPARTMENTS.pd.showLeadTime).toBe(false);
    expect(DEPARTMENTS.marvel.showLeadTime).toBe(false);
  });

  it('cả ba bộ phận đều tra cứu được mọi project', () => {
    Object.values(DEPARTMENTS).forEach((dept) => {
      expect(dept.allProjects).toBe(true);
    });
  });
});

describe('departmentFor', () => {
  it('nhận ra bộ phận không phân biệt hoa thường', () => {
    expect(departmentFor('PD').key).toBe('pd');
    expect(departmentFor('Marvel').key).toBe('marvel');
  });

  it('nhận cả object khai báo lẫn chuỗi key', () => {
    expect(departmentFor(DEPARTMENTS.csf.key)).toBe(DEPARTMENTS.csf);
  });

  /** Không nhận ra thì trả bản CHẶT NHẤT, không phải bản mặc định hiện hết. */
  it('bộ phận lạ hoặc rỗng không được thấy gì thêm', () => {
    [undefined, null, '', 'khong-co-that'].forEach((key) => {
      const dept = departmentFor(key);
      expect(dept.showPrices).toBe(false);
      expect(dept.showLeadTime).toBe(false);
      expect(dept.allProjects).toBe(false);
    });
  });
});
