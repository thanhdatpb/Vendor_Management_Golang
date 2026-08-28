// ════════════════════════════════════════════════════════
//  MỘT NƠI DUY NHẤT QUYẾT ĐỊNH ROLE ĐI VỀ ROUTE NÀO (PR-S5)
//
//  Trước file này logic lặp 3 chỗ với hành vi KHÁC NHAU cho role lạ
//  (Login.jsx useEffect / goByRole / AuthCallback resolveRoleRoute) —
//  thêm role mới mà quên một chỗ thì user vào nhầm trang, không lỗi nào báo.
//  Login.jsx và AuthCallback.jsx giờ chỉ gọi roleRoute().
// ════════════════════════════════════════════════════════

/** Role lạ / rỗng đi về đây — cố tình KHÁC "/seller" để không lộ thành "mặc định là Seller". */
export const UNKNOWN_ROLE_ROUTE = '/';

const ROLE_ROUTES = {
  admin: '/admin',
  seller: '/seller',
  staffa: '/seller',
  staff: '/seller',
  vendor: '/vendor',
  staffb: '/vendor',
  csf: '/csf',
  marvel: '/marvel',
  pd: '/pd',
};

const normalizeRole = (role) => {
  const raw = typeof role === 'object' && role ? role.name : role;
  return raw ? raw.toString().toLowerCase().replace(/[_\-\s]/g, '') : '';
};

export const isKnownRole = (role) => normalizeRole(role) in ROLE_ROUTES;

export const roleRoute = (role) => {
  const key = normalizeRole(role);
  return ROLE_ROUTES[key] || UNKNOWN_ROLE_ROUTE;
};
