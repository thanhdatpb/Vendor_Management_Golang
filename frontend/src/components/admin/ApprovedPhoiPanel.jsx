import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HC } from './constants';
import { normalizeList } from './utils';
import { productApi } from '../../services/api';
import { subscribeProductChanges } from '../../services/echo';
import {
  collectApprovedPhoi,
  filterApprovedByProject,
  summarizePhoi,
  vendorKey,
} from '../../utils/approvedPhoiStats';
import { toDate, VN_TIMEZONE } from '../../utils/vnTime';

// ════════════════════════════════════════════════════════
//  KHỐI "THỐNG KÊ PHÔI" — chỉ Admin, nằm giữa thanh công cụ và danh sách file
//  của "Tổng quan Vendor & Sản phẩm".
//
//  Hai số liệu đứng RIÊNG (xem utils/approvedPhoiStats.js): phôi đã duyệt (đã
//  được cung cấp vendor) và phôi trong thư viện. Không có tỷ lệ giữa hai số.
//  Bấm một vendor = đặt ô "Tất cả vendor" của thư viện, nên danh sách file bên
//  dưới lọc theo cùng vendor đó.
// ════════════════════════════════════════════════════════

const APPROVED_COLOR = HC.orangeDark;
const LIBRARY_COLOR = HC.muted2;
const RECENT_LIMIT = 5;
const COLLAPSED_KEY = 'ADMIN_LIBRARY_STATS_COLLAPSED';

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}
function writeCollapsed(value) {
  try { localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0'); } catch { /* chế độ riêng tư: bỏ qua */ }
}

/** "22/09/2026" theo giờ Việt Nam; không có ngày thì "—". */
function fmtDay(value) {
  const d = toDate(value);
  if (!d) return '—';
  try {
    return d.toLocaleDateString('vi-VN', { timeZone: VN_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

const ghostBtn = {
  height: 36, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px',
  borderRadius: 18, border: `1px solid ${HC.border}`, background: HC.surface, color: HC.ink2,
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap',
};

const Chevron = ({ up }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
);

function Stat({ color, label, value, note, divider }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      ...(divider ? { paddingLeft: 28, borderLeft: `1px solid ${HC.border}` } : { paddingRight: 28 }),
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: HC.ink2 }}>
        <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
        {label}
      </span>
      <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05, color: HC.ink }}>{value}</span>
      <span style={{ fontSize: 12, color: HC.brown }}>{note}</span>
    </div>
  );
}

/**
 * @param {object}   props
 * @param {Array}    props.files        file thư viện đang hoạt động, đã lọc theo ô Project
 * @param {boolean}  props.libraryLoaded thư viện đã tải xong lần đầu chưa
 * @param {string}   props.projectFilter id project đang lọc ('' = mọi project)
 * @param {string}   props.vendorFilter  vendor đang lọc ở ô "Tất cả vendor"
 * @param {Function} props.onVendorFilterChange
 */
export default function ApprovedPhoiPanel({ files, libraryLoaded = true, projectFilter = '', vendorFilter = '', onVendorFilterChange }) {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [showAll, setShowAll] = useState(false);
  // Tăng lên để tải lại từ đầu (nút "Thử lại").
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let alive = true;
    const fetchApproved = (silent) => productApi.getApprovedProducts()
      .then((res) => {
        if (!alive) return;
        setProducts(normalizeList(res));
        setStatus('ready');
      })
      .catch((err) => {
        console.error('Không tải được Request đã duyệt:', err);
        // Làm mới nền hỏng thì giữ số đang hiện, không dựng lỗi đè lên.
        if (alive && !silent) setStatus('error');
      });

    fetchApproved(false);
    // Duyệt Request / cung cấp vendor ở máy khác → số liệu tự cập nhật.
    const unsubscribe = subscribeProductChanges(() => fetchApproved(true));
    return () => { alive = false; unsubscribe(); };
  }, [reloadToken]);

  const retry = useCallback(() => {
    setStatus('loading');
    setReloadToken((n) => n + 1);
  }, []);

  const approvedAll = useMemo(() => collectApprovedPhoi(products), [products]);
  const approved = useMemo(() => filterApprovedByProject(approvedAll, projectFilter), [approvedAll, projectFilter]);
  const summary = useMemo(() => summarizePhoi(approved, files), [approved, files]);

  const selectedKey = vendorKey(vendorFilter);
  const recentAll = useMemo(
    () => (selectedKey ? approved.filter((item) => item.vendorKey === selectedKey) : approved),
    [approved, selectedKey],
  );
  const recent = showAll ? recentAll : recentAll.slice(0, RECENT_LIMIT);
  const maxBar = Math.max(1, ...summary.vendors.map((v) => Math.max(v.approved, v.library)));

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      writeCollapsed(!prev);
      return !prev;
    });
  };
  const pickVendor = (vendor) => {
    if (!onVendorFilterChange) return;
    onVendorFilterChange(vendor.key === selectedKey ? '' : vendor.name);
  };

  const approvedValue = status === 'ready' ? summary.approved : '…';
  const libraryValue = libraryLoaded ? summary.library : '…';

  if (collapsed) {
    return (
      <section aria-label="Thống kê phôi" style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', marginBottom: 20,
        borderRadius: 14, border: `1px solid ${HC.border}`, background: HC.orangePale, fontFamily: "'Inter',sans-serif",
      }}>
        <span style={{ fontSize: 13, color: HC.ink2 }}>
          <strong style={{ color: HC.ink }}>{approvedValue}</strong> phôi đã duyệt · <strong style={{ color: HC.ink }}>{libraryValue}</strong> phôi trong thư viện
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={toggleCollapsed} aria-expanded="false" style={ghostBtn}>
          Mở thống kê <Chevron />
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Thống kê phôi" style={{
      padding: '20px 24px', marginBottom: 20, borderRadius: 16, border: `1px solid ${HC.border}`,
      background: HC.surface, boxShadow: '0 10px 30px rgba(245,166,35,0.06)',
      display: 'flex', flexDirection: 'column', gap: 18, fontFamily: "'Inter',sans-serif",
      fontVariantNumeric: 'tabular-nums',
    }}>
      <style>{`
        .hc-phoi-vrow { transition: background-color 160ms ease-out; }
        .hc-phoi-vrow:hover { background: ${HC.cream} !important; }
        .hc-phoi-vrow:focus-visible, .hc-phoi-link:focus-visible { outline: 3px solid ${HC.orangeGlow}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .hc-phoi-vrow { transition: none; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', rowGap: 12 }}>
        <Stat
          color={APPROVED_COLOR}
          label="Phôi đã duyệt"
          value={approvedValue}
          note="Duyệt từ khi hệ thống hoạt động và đã được cung cấp vendor"
        />
        <Stat
          divider
          color={LIBRARY_COLOR}
          label="Phôi trong thư viện"
          value={libraryValue}
          note={libraryLoaded ? `Trong ${summary.fileCount} file vendor đang hoạt động` : 'Đang tải thư viện…'}
        />
        <span style={{ flex: 1 }} />
        <div>
          <button type="button" onClick={toggleCollapsed} aria-expanded="true" style={ghostBtn}>
            Thu gọn <Chevron up />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start' }}>
        {/* Theo vendor: hai thanh RIÊNG cùng một thước đo — không lồng vào nhau */}
        <div style={{ flex: '0.85 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 10px 6px' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: HC.ink }}>Theo vendor</h3>
            <span style={{ fontSize: 12, color: HC.brown }}>bấm để lọc</span>
          </div>
          {summary.vendors.length === 0 && (
            <div style={{ padding: '16px 10px', fontSize: 13, color: HC.brown }}>Chưa có vendor nào.</div>
          )}
          {summary.vendors.map((v) => {
            const on = v.key === selectedKey;
            return (
              <button
                key={v.key}
                type="button"
                className="hc-phoi-vrow"
                onClick={() => pickVendor(v)}
                aria-pressed={on}
                aria-label={`${v.name}: ${v.approved} phôi đã duyệt, ${v.library} phôi trong thư viện`}
                style={{
                  display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr) 34px', gap: 12, alignItems: 'center',
                  minHeight: 44, padding: '5px 10px', borderRadius: 10, width: '100%', boxSizing: 'border-box',
                  border: `1.5px solid ${on ? HC.orange : 'transparent'}`, background: on ? HC.cream : HC.surface,
                  cursor: onVendorFilterChange ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 800, color: HC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ display: 'block', height: 10, width: `${(v.approved / maxBar) * 100}%`, minWidth: 2, borderRadius: 3, background: APPROVED_COLOR }} />
                  <span style={{ display: 'block', height: 10, width: `${(v.library / maxBar) * 100}%`, minWidth: v.library ? 2 : 0, borderRadius: 3, background: LIBRARY_COLOR }} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 12, textAlign: 'right', lineHeight: 1.1 }}>
                  <strong style={{ color: HC.ink }}>{v.approved}</strong>
                  <span style={{ color: HC.brown }}>{v.library}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Mới duyệt: mỗi dòng là một phôi được cung cấp cho một Request đã duyệt */}
        <div style={{ flex: '1.15 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: HC.ink }}>Mới duyệt</h3>

          {status === 'loading' && (
            <div style={{ padding: '20px 0', fontSize: 13, color: HC.brown }}>Đang tải phôi đã duyệt…</div>
          )}
          {status === 'error' && (
            <div role="alert" style={{ padding: '14px 0', fontSize: 13, color: HC.danger, display: 'flex', alignItems: 'center', gap: 12 }}>
              Không tải được danh sách phôi đã duyệt.
              <button type="button" onClick={retry} style={ghostBtn}>Thử lại</button>
            </div>
          )}
          {status === 'ready' && recentAll.length === 0 && (
            <div style={{ padding: '20px 0', fontSize: 13, color: HC.brown }}>
              {selectedKey ? `Vendor ${vendorFilter} chưa có phôi nào được duyệt.` : 'Chưa có phôi nào được duyệt và cung cấp vendor.'}
            </div>
          )}
          {status === 'ready' && recentAll.length > 0 && (
            <>
              <div style={showAll ? { maxHeight: 360, overflowY: 'auto' } : undefined}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: HC.brown, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      <th scope="col" style={{ padding: '0 0 8px', borderBottom: `1px solid ${HC.border}`, fontWeight: 700 }}>Phôi</th>
                      <th scope="col" style={{ padding: '0 0 8px', borderBottom: `1px solid ${HC.border}`, fontWeight: 700, width: 96 }}>Project</th>
                      <th scope="col" style={{ padding: '0 0 8px', borderBottom: `1px solid ${HC.border}`, fontWeight: 700, width: 92 }}>Request</th>
                      <th scope="col" style={{ padding: '0 0 8px', borderBottom: `1px solid ${HC.border}`, fontWeight: 700, width: 92 }}>Duyệt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((item) => (
                      <tr key={item.key} style={{ borderBottom: `1px solid ${HC.orangeLight}` }}>
                        <td style={{ padding: '9px 12px 9px 0', maxWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: HC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.requestName ? `Request: ${item.requestName}` : undefined}>{item.phoi}</div>
                          <div style={{ fontSize: 12, color: HC.brown }}>{item.vendor}</div>
                        </td>
                        <td style={{ padding: '9px 8px 9px 0' }}>
                          {item.project
                            ? <span style={{ fontSize: 12, fontWeight: 700, color: HC.ink2, padding: '3px 9px', borderRadius: 999, border: `1px solid ${HC.border}`, background: HC.orangePale, whiteSpace: 'nowrap' }}>{item.project}</span>
                            : <span style={{ color: HC.brown }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 8px 9px 0', color: HC.brown, whiteSpace: 'nowrap' }}>{fmtDay(item.requestedAt)}</td>
                        <td style={{ padding: '9px 0', fontWeight: 800, color: HC.ink, whiteSpace: 'nowrap' }}>{fmtDay(item.approvedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recentAll.length > RECENT_LIMIT && (
                <button
                  type="button"
                  className="hc-phoi-link"
                  onClick={() => setShowAll((v) => !v)}
                  style={{ ...ghostBtn, border: 'none', background: 'transparent', padding: 0, alignSelf: 'flex-start', color: HC.brown }}
                >
                  {showAll ? 'Thu lại' : `Xem tất cả (${recentAll.length})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
