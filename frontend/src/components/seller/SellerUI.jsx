// ════════════════════════════════════════════════════════
//  SELLER UI COMPONENTS — Shared small components
// ════════════════════════════════════════════════════════
import { AppstoreOutlined, ShopOutlined, DollarOutlined } from '@ant-design/icons';
import { HC, STATUS_CFG } from '../../constants/sellerTheme';
import logoImg from '../../assets/logo.png';

export { HC, STATUS_CFG };

// ─── Empty form default ──────────────────────────────────
export const EMPTY_FORM = {
  product_type: '', mediaFiles: [],
  product_type_links: [],
  other_specs: '', material: '', print_area: '',
  good_review: '', bad_review: '', packaging_links: '', other_packaging: '',
};

// ─── Menu items ─────────────────────────────────────────
export const MENU = [
  { id: 'products',    icon: <AppstoreOutlined />, label: 'Quản Lý Sản Phẩm', desc: 'Quản lý yêu cầu từ Sales' },
  { id: 'vendors',     icon: <ShopOutlined />,     label: 'Thư Viện Vendor',   desc: 'Danh mục nhà cung cấp' },
  { id: 'setup_price', icon: <DollarOutlined />,   label: 'Thiết Lập Giá',     desc: 'Cấu hình giá bán' },
];

// ─── Input style ─────────────────────────────────────────
export const inp = {
  padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${HC.border}`,
  fontSize: 13, color: HC.ink2, background: HC.surface2,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

// ─── Logo ────────────────────────────────────────────────
export function HCLogo({ size = 32 }) {
  return (
    <img
      src={logoImg}
      alt="Happy Creative Logo"
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  );
}

// ─── Media Gallery ───────────────────────────────────────
export function MediaGallery({ mediaUrls = [] }) {
  if (!mediaUrls.length) return <span style={{ color: HC.muted2, fontSize: 11 }}>—</span>;
  const firstUrl = mediaUrls[0];
  const isVideo = firstUrl && (firstUrl.match(/\.(mp4|webm|mov)$/i) || firstUrl.includes('video'));
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        width: 60, height: 60, borderRadius: 8, overflow: 'hidden',
        background: '#2a1a00', border: `1.5px solid ${HC.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isVideo
          ? <video src={firstUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <img src={firstUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        }
      </div>
      {mediaUrls.length > 1 && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          fontSize: 9, padding: '1px 5px', borderRadius: 10, pointerEvents: 'none',
        }}>+{mediaUrls.length - 1}</span>
      )}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: HC.muted }}>
      <HCLogo size={36} color={HC.orange} />
      <div>Đang tải...</div>
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────────
export function EmptyState({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: HC.muted }}>
      <HCLogo size={40} color={HC.orangeMid} />
      <div>{msg}</div>
    </div>
  );
}

// ─── Field ───────────────────────────────────────────────
export function Field({ label, hint, required, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, fontWeight: 800, color: error ? HC.danger : HC.muted }}>
        {label}
        {required && <span style={{ color: HC.danger }}>*</span>}
        {hint && <span style={{ marginLeft: 4, fontWeight: 400 }}>({hint})</span>}
      </label>
      {children}
      {error && <span style={{ color: HC.danger, fontSize: 10, marginTop: 2 }}>⚠ {error}</span>}
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────
export function Pagination({ currentPage, totalPages, totalItems, onPageChange, itemsPerPage = 10 }) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);
  const pages = [];
  const push = n => { if (!pages.includes(n)) pages.push(n); };
  push(1);
  if (currentPage > 3) pages.push('...');
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) push(i);
  if (currentPage < totalPages - 2) pages.push('...');
  if (totalPages > 1) push(totalPages);

  const btn = (ex = {}) => ({
    minWidth: 32, height: 32, borderRadius: 8, border: `1.5px solid ${HC.border}`,
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 8px', fontFamily: "'Nunito',sans-serif", ...ex,
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10, marginTop: 14, padding: '10px 16px',
      background: HC.surface, borderRadius: 12, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow,
    }}>
      <div style={{ fontSize: 12, color: HC.muted, fontWeight: 600, fontFamily: "'Nunito Sans',sans-serif" }}>
        Hiển thị <b style={{ color: HC.ink }}>{from}–{to}</b> / <b style={{ color: HC.ink }}>{totalItems}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
          style={btn({ background: HC.cream, color: HC.muted2, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' })}>‹</button>
        {pages.map((p, i) => p === '...'
          ? <span key={`g${i}`} style={{ fontSize: 12, color: HC.muted2 }}>…</span>
          : <button key={p} onClick={() => onPageChange(p)} style={btn({
              background: currentPage === p ? HC.orange : HC.surface,
              color: currentPage === p ? '#fff' : HC.ink2,
              border: `1.5px solid ${currentPage === p ? HC.orange : HC.border}`,
              fontWeight: currentPage === p ? 900 : 700,
            })}>{p}</button>
        )}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
          style={btn({ background: HC.cream, color: HC.muted2, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' })}>›</button>
      </div>
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────
export function Badge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{
      background: c.bg, color: c.text, padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center',
      gap: 6, border: `1px solid ${HC.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {c.label}
    </span>
  );
}

// ─── CardHeader ──────────────────────────────────────────
export function CardHeader({ icon, title, subtitle, badge, dimmed = false }) {
  const bg = dimmed
    ? `linear-gradient(135deg,${HC.muted},${HC.brownLight})`
    : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`;
  return (
    <div style={{ padding: '12px 14px', background: bg, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 10, color: '#fff', fontFamily: "'Nunito',sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: "'Nunito Sans',sans-serif", marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>
      {badge && <span style={{ flexShrink: 0, padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 10, fontWeight: 900, fontFamily: "'Nunito',sans-serif", border: '1px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{badge}</span>}
    </div>
  );
}

// ─── InfoRow ─────────────────────────────────────────────
export function InfoRow({ label, value, valueColor, valueBold, idx, isLast }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: isLast ? 'none' : `1px solid ${HC.border}`, background: idx % 2 === 0 ? HC.surface : HC.surface2, minHeight: 34 }}>
      <span style={{ minWidth: 108, flexShrink: 0, fontWeight: 800, color: HC.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2, fontFamily: "'Nunito',sans-serif", lineHeight: 1.4 }}>{label}</span>
      <span style={{ color: valueColor || HC.ink2, fontWeight: valueBold ? 700 : 400, flex: 1, wordBreak: 'break-word', fontFamily: "'Nunito Sans',sans-serif", fontSize: 12, lineHeight: 1.4 }}>{value || '—'}</span>
    </div>
  );
}
