// ════════════════════════════════════════════════════════
//  PR-S5 — MỘT NƠI DUY NHẤT QUYẾT ĐỊNH ROLE ĐI VỀ ROUTE NÀO
//  ⛔ ĐỎ LÀ ĐÚNG cho tới khi `utils/roleRoute.js` được rút ra.
//
//  Hôm nay logic này lặp ở 3 chỗ với hành vi KHÁC NHAU cho role lạ:
//    - Login.jsx:39-44   (useEffect)  → không điều hướng gì cả
//    - Login.jsx:63-69   (goByRole)   → về "/"
//    - AuthCallback.jsx  (resolveRoleRoute) → rơi im lặng về "/seller"
//  Thêm một role mới mà quên một chỗ = user vào nhầm trang mà không có lỗi nào.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';

const load = () => import('../roleRoute');

describe('roleRoute — phủ hết role hợp lệ', () => {
  it.each([
    ['admin', '/admin'],
    ['seller', '/seller'],
    ['staff_a', '/seller'],
    ['staff', '/seller'],
    ['vendor', '/vendor'],
    ['staff_b', '/vendor'],
    ['csf', '/csf'],
    ['pd', '/pd'],
    ['marvel', '/marvel'],
  ])('role "%s" → %s', async (role, path) => {
    const { roleRoute } = await load();
    expect(roleRoute(role)).toBe(path);
  });

  it('chuẩn hoá hoa thường, gạch dưới, khoảng trắng', async () => {
    const { roleRoute } = await load();
    expect(roleRoute(' Staff-B ')).toBe('/vendor');
    expect(roleRoute('STAFF_A')).toBe('/seller');
  });

  it('đọc được cả role dạng object { name } như API trả về', async () => {
    const { roleRoute } = await load();
    expect(roleRoute({ name: 'marvel' })).toBe('/marvel');
  });
});

describe('roleRoute — role lạ không được rơi im lặng', () => {
  it('trả fallback tường minh, KHÔNG phải /seller', async () => {
    const { roleRoute, UNKNOWN_ROLE_ROUTE } = await load();
    expect(roleRoute('role-khong-ton-tai')).toBe(UNKNOWN_ROLE_ROUTE);
    expect(UNKNOWN_ROLE_ROUTE).not.toBe('/seller');
  });

  it('role rỗng / null cũng vào fallback', async () => {
    const { roleRoute, UNKNOWN_ROLE_ROUTE } = await load();
    expect(roleRoute('')).toBe(UNKNOWN_ROLE_ROUTE);
    expect(roleRoute(null)).toBe(UNKNOWN_ROLE_ROUTE);
  });

  it('isKnownRole phân biệt được role hợp lệ và role lạ', async () => {
    const { isKnownRole } = await load();
    expect(isKnownRole('marvel')).toBe(true);
    expect(isKnownRole('nguoi-la')).toBe(false);
  });
});
