import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HC } from './constants';
import { normalizeList } from './utils';
import { productApi } from '../../services/api';
import { subscribeProductChanges } from '../../services/echo';
import {
  collectApprovedPhoi,
  filterApprovedByProject,
  libraryPhoiOfVendor,
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
// Số vendor hiện sẵn; còn lại mở bằng "Xem tất cả vendor" để khối không dài
// quá danh sách file bên dưới.
const VENDOR_LIMIT = 6;
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

// Số đứng trước, nhãn + chú thích xếp bên phải — gọn một hàng thay vì ba.
function Stat({ color, label, value, note, divider }) {
  return (
    <div role="group" aria-label={label} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      ...(divider ? { paddingLeft: 24, borderLeft: `1px solid ${HC.border}` } : { paddingRight: 24 }),
    }}>
      <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: HC.ink }}>{value}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: HC.ink2 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          {label}
        </span>
        <span style={{ fontSize: 11.5, color: HC.brown }}>{note}</span>
      </span>
    </div>
  );
}

const headRow = { textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: HC.brown, textTransform: 'uppercase', letterSpacing: 0.3 };
const th = (width) => ({ padding: '0 0 6px', borderBottom: `1px solid ${HC.border}`, fontWeight: 700, ...(width ? { width } : {}) });
const rowLine = { borderBottom: `1px solid ${HC.orangeLight}` };
const nameCell = { fontSize: 12.5, fontWeight: 700, color: HC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const mutedCell = { padding: '6px 8px 6px 0', color: HC.brown, whiteSpace: 'nowrap' };

function ProjectPill({ project }) {
  if (!project) return <span style={{ color: HC.brown }}>—</span>;
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color: HC.ink2, padding: '2px 8px', borderRadius: 999, border: `1px solid ${HC.border}`, background: HC.orangePale, whiteSpace: 'nowrap' }}>
      {project}
    </span>
  );
}

function LoadError({ onRetry }) {
  return (
    <div role="alert" style={{ padding: '10px 0', fontSize: 12.5, color: HC.danger, display: 'flex', alignItems: 'center', gap: 12 }}>
      Không tải được danh sách phôi đã duyệt.
      <button type="button" onClick={onRetry} style={{ ...ghostBtn, height: 30 }}>Thử lại</button>
    </div>
  );
}

/** Phôi đã duyệt: mỗi dòng là một phôi được cung cấp cho một Request đã duyệt. */
function ApprovedTable({ rows, showVendor = false }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={headRow}>
          <th scope="col" style={th()}>Phôi</th>
          {showVendor && <th scope="col" style={th(64)}>Vendor</th>}
          <th scope="col" style={th(92)}>Project</th>
          <th scope="col" style={th(84)}>Request</th>
          <th scope="col" style={th(84)}>Duyệt</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.key} style={rowLine}>
            <td style={{ padding: '6px 10px 6px 0', maxWidth: 0 }}>
              <div style={nameCell} title={item.requestName ? `${item.phoi} · Request: ${item.requestName}` : item.phoi}>{item.phoi}</div>
            </td>
            {showVendor && <td style={{ ...mutedCell, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.vendor}</td>}
            <td style={{ padding: '6px 8px 6px 0' }}><ProjectPill project={item.project} /></td>
            <td style={mutedCell}>{fmtDay(item.requestedAt)}</td>
            <td style={{ padding: '6px 0', fontWeight: 800, color: HC.ink, whiteSpace: 'nowrap' }}>{fmtDay(item.approvedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Phôi đang có trong thư viện của một vendor. */
function LibraryTable({ rows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={headRow}>
          <th scope="col" style={th()}>Phôi</th>
          <th scope="col" style={th('38%')}>File</th>
          <th scope="col" style={th(84)}>Nhập ngày</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.key} style={rowLine}>
            <td style={{ padding: '6px 10px 6px 0', maxWidth: 0 }}>
              <div style={nameCell} title={item.phoi}>{item.phoi}</div>
            </td>
            <td style={{ ...mutedCell, maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.fileName}>{item.fileName || '—'}</td>
            <td style={{ padding: '6px 0', color: HC.ink2, whiteSpace: 'nowrap' }}>{fmtDay(item.importedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
  const [showAllVendors, setShowAllVendors] = useState(false);
  // Tab "Đã duyệt / Trong thư viện" khi đang xem một vendor; nhớ theo vendor.
  const [tabState, setTabState] = useState({ key: '', tab: '' });
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
  // Vendor đang lọc nằm ngoài top thì vẫn hiện để thấy được nó đang được chọn.
  const visibleVendors = useMemo(() => {
    if (showAllVendors || summary.vendors.length <= VENDOR_LIMIT) return summary.vendors;
    const top = summary.vendors.slice(0, VENDOR_LIMIT);
    const picked = summary.vendors.find((v) => v.key === selectedKey);
    return picked && !top.includes(picked) ? [...top, picked] : top;
  }, [summary.vendors, showAllVendors, selectedKey]);

  const vendorLibrary = useMemo(() => libraryPhoiOfVendor(files, selectedKey), [files, selectedKey]);
  const selectedName = summary.vendors.find((v) => v.key === selectedKey)?.name || vendorFilter;
  // Mặc định mở tab có dữ liệu: vendor chưa có phôi duyệt thì vào thẳng thư viện.
  const vendorTab = tabState.key === selectedKey && tabState.tab
    ? tabState.tab
    : (status === 'ready' && recentAll.length === 0 ? 'library' : 'approved');

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
      padding: '14px 20px', marginBottom: 20, borderRadius: 16, border: `1px solid ${HC.border}`,
      background: HC.surface, boxShadow: '0 10px 30px rgba(245,166,35,0.06)',
      display: 'flex', flexDirection: 'column', gap: 12, fontFamily: "'Inter',sans-serif",
      fontVariantNumeric: 'tabular-nums',
    }}>
      <style>{`
        .hc-phoi-vrow { transition: background-color 160ms ease-out; }
        .hc-phoi-vrow:hover { background: ${HC.cream} !important; }
        .hc-phoi-vrow:focus-visible, .hc-phoi-link:focus-visible, .hc-phoi-tab:focus-visible { outline: 3px solid ${HC.orangeGlow}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .hc-phoi-vrow { transition: none; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 10 }}>
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
        <button type="button" onClick={toggleCollapsed} aria-expanded="true" style={{ ...ghostBtn, height: 32 }}>
          Thu gọn <Chevron up />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        {/* Theo vendor: hai thanh RIÊNG cùng một thước đo — không lồng vào nhau */}
        <div style={{ flex: '0.85 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 8px 4px' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: HC.ink }}>Theo vendor</h3>
            <span style={{ fontSize: 11.5, color: HC.brown }}>bấm để xem phôi của vendor</span>
          </div>
          {summary.vendors.length === 0 && (
            <div style={{ padding: '10px 8px', fontSize: 12.5, color: HC.brown }}>Chưa có vendor nào.</div>
          )}
          {visibleVendors.map((v) => {
            const on = v.key === selectedKey;
            return (
              <button
                key={v.key}
                type="button"
                className="hc-phoi-vrow"
                onClick={() => pickVendor(v)}
                aria-pressed={on}
                aria-label={`${v.name}: ${v.approved} phôi đã duyệt, ${v.library} phôi trong thư viện`}
                title={v.name}
                style={{
                  display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) 30px', gap: 10, alignItems: 'center',
                  minHeight: 30, padding: '3px 8px', borderRadius: 8, width: '100%', boxSizing: 'border-box',
                  border: `1.5px solid ${on ? HC.orange : 'transparent'}`, background: on ? HC.cream : HC.surface,
                  cursor: onVendorFilterChange ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: 800, color: HC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'block', height: 6, width: `${(v.approved / maxBar) * 100}%`, minWidth: 2, borderRadius: 3, background: APPROVED_COLOR }} />
                  <span style={{ display: 'block', height: 6, width: `${(v.library / maxBar) * 100}%`, minWidth: v.library ? 2 : 0, borderRadius: 3, background: LIBRARY_COLOR }} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', fontSize: 11, textAlign: 'right', lineHeight: 1.05 }}>
                  <strong style={{ color: HC.ink }}>{v.approved}</strong>
                  <span style={{ color: HC.brown }}>{v.library}</span>
                </span>
              </button>
            );
          })}
          {summary.vendors.length > VENDOR_LIMIT && (
            <button
              type="button"
              className="hc-phoi-link"
              onClick={() => setShowAllVendors((value) => !value)}
              style={{ ...ghostBtn, height: 28, border: 'none', background: 'transparent', padding: '0 8px', alignSelf: 'flex-start', color: HC.brown, fontSize: 12 }}
            >
              {showAllVendors ? 'Thu lại' : `Xem tất cả vendor (${summary.vendors.length})`}
            </button>
          )}
        </div>

        <div style={{ flex: '1.15 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {selectedKey ? (
            // Đang chọn một vendor: liệt kê MỌI phôi của vendor đó, tách hai loại.
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: HC.ink }}>Phôi của {selectedName}</h3>
                <div role="group" aria-label={`Loại phôi của ${selectedName}`} style={{ display: 'inline-flex', gap: 2, padding: 2, borderRadius: 16, border: `1px solid ${HC.border}`, background: HC.orangePale }}>
                  {[
                    { id: 'approved', label: 'Đã duyệt', count: status === 'ready' ? recentAll.length : '…', color: APPROVED_COLOR },
                    { id: 'library', label: 'Trong thư viện', count: libraryLoaded ? vendorLibrary.length : '…', color: LIBRARY_COLOR },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="hc-phoi-tab"
                      aria-pressed={vendorTab === t.id}
                      onClick={() => setTabState({ key: selectedKey, tab: t.id })}
                      style={{
                        height: 28, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRadius: 14,
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                        background: vendorTab === t.id ? HC.surface : 'transparent', color: vendorTab === t.id ? HC.ink : HC.brown,
                        boxShadow: vendorTab === t.id ? '0 1px 3px rgba(26,15,0,0.08)' : 'none',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: t.color }} />
                      {t.label} ({t.count})
                    </button>
                  ))}
                </div>
                <span style={{ flex: 1 }} />
                {onVendorFilterChange && (
                  <button type="button" className="hc-phoi-link" onClick={() => onVendorFilterChange('')} style={{ ...ghostBtn, height: 28, fontSize: 12 }}>
                    Bỏ lọc
                  </button>
                )}
              </div>

              {vendorTab === 'approved' ? (
                <>
                  {status === 'loading' && <div style={{ padding: '12px 0', fontSize: 12.5, color: HC.brown }}>Đang tải phôi đã duyệt…</div>}
                  {status === 'error' && <LoadError onRetry={retry} />}
                  {status === 'ready' && recentAll.length === 0 && (
                    <div style={{ padding: '12px 0', fontSize: 12.5, color: HC.brown }}>Vendor {selectedName} chưa có phôi nào được duyệt.</div>
                  )}
                  {status === 'ready' && recentAll.length > 0 && (
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                      <ApprovedTable rows={recentAll} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!libraryLoaded && <div style={{ padding: '12px 0', fontSize: 12.5, color: HC.brown }}>Đang tải thư viện…</div>}
                  {libraryLoaded && vendorLibrary.length === 0 && (
                    <div style={{ padding: '12px 0', fontSize: 12.5, color: HC.brown }}>Vendor {selectedName} không có phôi nào trong thư viện.</div>
                  )}
                  {libraryLoaded && vendorLibrary.length > 0 && (
                    <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                      <LibraryTable rows={vendorLibrary} />
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            // Chưa chọn vendor: phôi mới duyệt gần đây của mọi vendor.
            <>
              <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: HC.ink }}>Mới duyệt</h3>
              {status === 'loading' && <div style={{ padding: '12px 0', fontSize: 12.5, color: HC.brown }}>Đang tải phôi đã duyệt…</div>}
              {status === 'error' && <LoadError onRetry={retry} />}
              {status === 'ready' && recentAll.length === 0 && (
                <div style={{ padding: '12px 0', fontSize: 12.5, color: HC.brown }}>Chưa có phôi nào được duyệt và cung cấp vendor.</div>
              )}
              {status === 'ready' && recentAll.length > 0 && (
                <>
                  <div style={showAll ? { maxHeight: 240, overflowY: 'auto' } : undefined}>
                    <ApprovedTable rows={recent} showVendor />
                  </div>
                  {recentAll.length > RECENT_LIMIT && (
                    <button
                      type="button"
                      className="hc-phoi-link"
                      onClick={() => setShowAll((v) => !v)}
                      style={{ ...ghostBtn, height: 28, border: 'none', background: 'transparent', padding: 0, alignSelf: 'flex-start', color: HC.brown, fontSize: 12 }}
                    >
                      {showAll ? 'Thu lại' : `Xem tất cả (${recentAll.length})`}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
