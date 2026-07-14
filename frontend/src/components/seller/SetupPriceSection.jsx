// ════════════════════════════════════════════════════════
//  SETUP PRICE SECTION — Danh sách "Bảng tính giá"
//  Thay việc tính giá qua Google Sheet: mỗi bảng = 1 listing.
//  Seller tự gom Product Type từ Thư viện Vendor vào một bảng.
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HC } from '../../constants/sellerTheme';
import AppToast from '../shared/AppToast';
import { Pagination } from './SellerUI';
import { vendorLibraryApi, priceSheetApi } from '../../services/api';
import { summarizeSheet, usd, pct, makeSheet, makeProductType, makeSize } from '../../utils/pricingEngine';
import PriceSheetWorkspace, { exportSheetToExcel } from './PriceSheetWorkspace';

const LS_SHEETS = 'PRICE_SHEETS_V1';
const ITEMS_PER_PAGE = 10;

// ── Project filter helpers (mirror VendorLibraryViewer) ──
function _extractFileProject(filename) {
  if (!filename) return null;
  const fn = filename.toLowerCase();
  if (fn.includes('p.hapify84')) return 'hapify84';
  if (fn.includes('p.happy')) return 'happy';
  if (fn.includes('p.creative')) return 'creative';
  if (fn.includes('p.global')) return 'global';
  return null;
}
function _getUserProjectKey() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const role = (u.role || '').toLowerCase().replace(/[-_\s]/g, '');
    if (role === 'admin' || role === 'staffb' || role === 'vendor') return { skip: true, key: '' };
    return { skip: false, key: (u.project || u.name || u.seller_name || '').trim().toLowerCase() };
  } catch { return { skip: false, key: '' }; }
}

const loadAllSheets = () => { try { return JSON.parse(localStorage.getItem(LS_SHEETS) || '[]'); } catch { return []; } };
const persistAllSheets = (list) => localStorage.setItem(LS_SHEETS, JSON.stringify(list));

export default function SetupPriceSection() {
  const [allSheets, setAllSheets] = useState(loadAllSheets);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [workspaceSheet, setWorkspaceSheet] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [offline, setOffline] = useState(false);
  const initRef = useRef(false);

  const { skip, key: projectKey } = _getUserProjectKey();

  const showToast = useCallback((type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    let alive = true;
    setAllSheets(loadAllSheets()); // vẽ ngay từ cache local
    (async () => {
      try {
        const res = await priceSheetApi.list();
        const server = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
        if (!alive) return;
        setAllSheets(server);
        persistAllSheets(server);
        setOffline(false);
      } catch (err) {
        console.warn('Không tải được bảng tính giá từ server, dùng cache local:', err);
        if (alive) setOffline(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Sheets thuộc project của user
  const sheets = useMemo(() => {
    const mine = skip ? allSheets : allSheets.filter((s) => !s.project || !projectKey || s.project === projectKey || projectKey.includes(s.project) || s.project.includes(projectKey));
    return mine;
  }, [allSheets, skip, projectKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sheets;
    return sheets.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.vendorRef || '').toLowerCase().includes(q) ||
      (s.productTypes || []).some((pt) => (pt.name || '').toLowerCase().includes(q))
    );
  }, [sheets, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // ── CRUD ──
  const commitSheet = (updated) => {
    setAllSheets((prev) => {
      const exists = prev.some((s) => s.id === updated.id);
      const next = exists ? prev.map((s) => (s.id === updated.id ? updated : s)) : [updated, ...prev];
      persistAllSheets(next); // cache local
      return next;
    });
    // Đồng bộ lên server để mọi máy trong project thấy được
    priceSheetApi.save(updated)
      .then(() => setOffline(false))
      .catch((err) => {
        console.warn('Lưu bảng tính giá lên server thất bại:', err);
        setOffline(true);
        showToast('error', 'Chưa đồng bộ server', 'Đã lưu tạm ở máy này. Kiểm tra kết nối / đăng nhập rồi lưu lại.', 4500);
      });
  };

  const handleCreate = (sheet) => {
    commitSheet(sheet);
    setShowCreate(false);
    setWorkspaceSheet(sheet);
  };

  const handleSaveWorkspace = (updated) => {
    commitSheet(updated);
    setWorkspaceSheet(updated); // giữ mở với dữ liệu mới
  };

  const handleDelete = (sheet) => {
    if (!window.confirm(`Xoá bảng tính giá "${sheet.name}"?`)) return;
    setAllSheets((prev) => { const next = prev.filter((s) => s.id !== sheet.id); persistAllSheets(next); return next; });
    priceSheetApi.remove(sheet.id).catch((err) => {
      console.warn('Xoá trên server thất bại:', err);
      setOffline(true);
    });
    showToast('success', 'Đã xoá', sheet.name);
  };

  return (
    <div>
      <AppToast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 6, height: 24, borderRadius: 99, background: `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})` }} />
        <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink }}>Bảng tính giá</div>
        <span style={{ padding: '2px 10px', borderRadius: 20, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11, fontWeight: 700 }}>{filtered.length} bảng</span>
        {offline
          ? <span title="Chưa đồng bộ được với server — đang dùng dữ liệu tạm trên máy này" style={{ padding: '2px 10px', borderRadius: 20, background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 700, border: '1px solid #fbcfcf' }}>⚠ Chưa đồng bộ server</span>
          : <span title="Đã đồng bộ với server — các máy khác cùng project sẽ thấy" style={{ padding: '2px 10px', borderRadius: 20, background: '#ecfdf5', color: HC.success, fontSize: 11, fontWeight: 700, border: '1px solid #bbf0cc' }}>☁ Đồng bộ server</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Tìm bảng / vendor / product..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface, color: HC.ink, outline: 'none', width: 220 }} />
          <button onClick={() => setShowCreate(true)}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
            ＋ Tạo bảng tính giá
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: HC.surface, borderRadius: 14, border: `1px solid ${HC.border}` }}>
          <div style={{ fontSize: 42, marginBottom: 12, opacity: 0.5 }}>🧮</div>
          <div style={{ fontWeight: 700, color: HC.ink2, marginBottom: 6 }}>Chưa có bảng tính giá nào</div>
          <div style={{ fontSize: 13, color: HC.muted, marginBottom: 18 }}>Tạo bảng để tính giá trực tiếp trong hệ thống — thay cho Google Sheet.</div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '9px 20px', borderRadius: 9, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}>＋ Tạo bảng tính giá đầu tiên</button>
        </div>
      ) : (
        <>
          <div style={{ borderRadius: 14, border: `1.5px solid ${HC.border}`, background: HC.surface, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})` }}>
                    {['#', 'Bảng tính giá', 'Vendor', 'Product Type', 'Size', 'Khoảng giá', 'Avg Margin', 'Cập nhật', 'Thao tác'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 10px', color: '#fff', fontWeight: 700, textAlign: i === 0 || i > 3 ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((sheet, idx) => {
                    const sum = summarizeSheet(sheet);
                    const pts = sheet.productTypes || [];
                    return (
                      <tr key={sheet.id} style={{ borderBottom: `1px solid ${HC.border}`, background: idx % 2 === 0 ? '#fff' : HC.surface2 }}>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, color: HC.muted, fontVariantNumeric: 'tabular-nums' }}>{(page - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: 800, color: HC.ink2 }}>{sheet.name || '—'}</div>
                          {sheet._sourceFile && <div style={{ fontSize: 10, color: HC.muted, marginTop: 2 }}>📄 {sheet._sourceFile}</div>}
                        </td>
                        <td style={{ padding: '10px', fontWeight: 600, color: HC.orange }}>{sheet.vendorRef || '—'}</td>
                        <td style={{ padding: '8px 10px', maxWidth: 240 }}>
                          {pts.length === 0 ? <span style={{ color: HC.muted, fontSize: 11 }}>—</span> : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {pts.slice(0, 3).map((pt) => <span key={pt.id} style={chip}>{pt.name || '—'}</span>)}
                              {pts.length > 3 && <span style={{ ...chip, background: HC.orangeLight, color: HC.orangeDark, borderColor: HC.orangeMid }}>+{pts.length - 3}</span>}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, background: HC.orangeLight, color: HC.orangeDark, fontWeight: 700, fontSize: 11 }}>{sum.count} size</span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: HC.ink2, fontVariantNumeric: 'tabular-nums' }}>
                          {sum.minPrice != null ? (sum.minPrice === sum.maxPrice ? usd(sum.minPrice) : `${usd(sum.minPrice)} – ${usd(sum.maxPrice)}`) : <span style={{ color: HC.muted }}>—</span>}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sum.avgMargin != null ? (sum.avgMargin > 25 ? HC.success : HC.warning) : HC.muted }}>
                          {sum.avgMargin != null ? pct(sum.avgMargin, 1) : '—'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontSize: 11, color: HC.muted, fontVariantNumeric: 'tabular-nums' }}>
                          {sheet.updatedAt ? new Date(sheet.updatedAt).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button onClick={() => setWorkspaceSheet(sheet)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>Mở bảng</button>
                            <button onClick={() => exportSheetToExcel(sheet, showToast)} title="Export Excel" style={{ padding: '5px 9px', borderRadius: 6, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.muted, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>⬇</button>
                            <button onClick={() => handleDelete(sheet)} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#fef2f2', color: HC.danger, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Xoá</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} itemsPerPage={ITEMS_PER_PAGE} />}
        </>
      )}

      {showCreate && (
        <CreateSheetModal projectKey={skip ? '' : projectKey} skip={skip} onClose={() => setShowCreate(false)} onCreate={handleCreate} showToast={showToast} />
      )}

      {workspaceSheet && (
        <PriceSheetWorkspace sheet={workspaceSheet} onSave={handleSaveWorkspace} onClose={() => setWorkspaceSheet(null)} showToast={showToast} />
      )}
    </div>
  );
}

const chip = { padding: '2px 8px', borderRadius: 10, background: HC.surface2, border: `1px solid ${HC.border}`, fontSize: 10, fontWeight: 600, color: HC.ink2, whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' };

// ════════════════════════════════════════════════════════
//  Create modal — gom Product Type từ Thư viện Vendor
// ════════════════════════════════════════════════════════
function CreateSheetModal({ projectKey, skip, onClose, onCreate, showToast }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [libItems, setLibItems] = useState([]);
  const [picked, setPicked] = useState({}); // key -> item
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await vendorLibraryApi.get('all');
        const files = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
        const filtered = (skip || !projectKey) ? files : files.filter((f) => {
          const fp = _extractFileProject(f.filename);
          return !fp || projectKey.includes(fp) || fp.includes(projectKey);
        });
        const items = [];
        filtered.forEach((file) => {
          const pricing = Array.isArray(file.pricing) ? file.pricing : [];
          const byPT = {};
          pricing.forEach((p) => {
            const pt = (p.productType || '').trim();
            if (!pt) return;
            if (!byPT[pt]) byPT[pt] = { productType: pt, vendor: (p.kyHieu || '').trim(), sizes: new Set() };
            if (p.size && String(p.size).trim() && p.size !== 'N/A') byPT[pt].sizes.add(String(p.size).trim());
          });
          Object.values(byPT).forEach((v) => items.push({
            key: `${file.id}::${v.productType}`,
            productType: v.productType,
            vendor: v.vendor,
            filename: (file.filename || '').replace(/\.[^.]+$/, ''),
            sizes: [...v.sizes],
          }));
        });
        if (alive) { setLibItems(items); setLoading(false); }
      } catch (err) {
        console.error('load library for create', err);
        if (alive) { setLibItems([]); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [projectKey, skip]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return libItems;
    return libItems.filter((i) => i.productType.toLowerCase().includes(s) || (i.vendor || '').toLowerCase().includes(s) || i.filename.toLowerCase().includes(s));
  }, [libItems, q]);

  const toggle = (item) => setPicked((p) => { const n = { ...p }; if (n[item.key]) delete n[item.key]; else n[item.key] = item; return n; });

  const create = (fromLibrary) => {
    const nm = name.trim() || 'Bảng tính giá mới';
    const sheet = makeSheet(nm, skip ? '' : projectKey);
    if (fromLibrary) {
      const items = Object.values(picked);
      if (items.length === 0) { showToast('error', 'Chưa chọn', 'Chọn ít nhất một Product Type để gom vào bảng.'); return; }
      sheet.productTypes = items.map((it) => {
        const pt = makeProductType(it.productType);
        pt.sizes = it.sizes.length ? it.sizes.map((lbl) => makeSize(lbl)) : [makeSize()];
        return pt;
      });
      const vendors = [...new Set(items.map((i) => i.vendor).filter(Boolean))];
      sheet.vendorRef = vendors.join(', ');
      sheet._sourceFile = [...new Set(items.map((i) => i.filename))].slice(0, 1)[0] || '';
    }
    onCreate(sheet);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,0,0.55)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 96vw)', maxHeight: '90vh', background: HC.surface, borderRadius: 16, boxShadow: HC.shadowStrong, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDeep})`, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>＋ Tạo bảng tính giá</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto' }}>
          <label style={{ fontSize: 11, fontWeight: 800, color: HC.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Tên bảng (= listing)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Legend Shirt (Hawaap22)" autoFocus
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, marginBottom: 18, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${HC.border}`, fontSize: 14, fontWeight: 600, color: HC.ink, outline: 'none' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: HC.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Gom Product Type từ thư viện</label>
            <span style={{ fontSize: 11, color: HC.orangeDark, fontWeight: 700 }}>{Object.keys(picked).length} đã chọn</span>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lọc product type / vendor..."
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10, padding: '8px 11px', borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, outline: 'none' }} />

          <div style={{ border: `1px solid ${HC.border}`, borderRadius: 10, maxHeight: 260, overflowY: 'auto', background: HC.surface2 }}>
            {loading ? <div style={{ padding: 30, textAlign: 'center', color: HC.muted }}>Đang tải thư viện…</div>
              : shown.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: HC.muted, fontSize: 13 }}>Không có product type nào trong thư viện của bạn. Vẫn có thể tạo bảng trống.</div>
                : shown.map((it) => {
                  const on = !!picked[it.key];
                  return (
                    <div key={it.key} onClick={() => toggle(it)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${HC.border}`, cursor: 'pointer', background: on ? HC.orangeLight : 'transparent' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? HC.orange : HC.borderStrong}`, background: on ? HC.orange : HC.surface, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, flexShrink: 0 }}>{on ? '✓' : ''}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: HC.ink2, fontSize: 13 }}>{it.productType}</div>
                        <div style={{ fontSize: 10.5, color: HC.muted }}>{it.vendor && `${it.vendor} · `}{it.sizes.length} size · 📄 {it.filename}</div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${HC.border}`, background: HC.surface2, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => create(false)} style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.brown, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Tạo bảng trống</button>
          <button onClick={() => create(true)} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>Tạo từ thư viện ({Object.keys(picked).length})</button>
        </div>
      </div>
    </div>
  );
}
