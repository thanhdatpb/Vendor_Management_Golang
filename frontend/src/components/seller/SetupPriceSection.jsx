// ════════════════════════════════════════════════════════
//  SETUP PRICE SECTION — Danh sách "Bảng tính giá"
//  Thay việc tính giá qua Google Sheet: mỗi bảng = 1 listing.
//  Seller tự gom Product Type từ Thư viện Vendor vào một bảng.
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HC } from '../../constants/sellerTheme';
import AppToast from '../shared/AppToast';
import { priceSheetApi } from '../../services/api';
import { saveSheetToServer } from '../../utils/priceSheetCommit';
import { subscribePriceSheetChanges } from '../../services/echo';
import { usd, pct, makeSheet } from '../../utils/pricingEngine';
import { normalizeSheetRow, matchesSheetSearch, sheetInProject, toSummaryRow } from '../../utils/priceSheetSummary';
import { priceSheetPath, copyPriceSheetLink } from '../../utils/priceSheetLink';
import { fmtVNDate } from '../../utils/vnTime';
import { loadVendorLibraryIndex, listLibraryRecords } from '../../utils/vendorLibraryIndex';
import { makeProductTypeFromRecord } from '../../utils/resolveSheet';
import { exportSheetToExcel } from './PriceSheetWorkspace';

const LS_SHEETS = 'PRICE_SHEETS_V1';

function _getUserProjectKey() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const role = (u.role || '').toLowerCase().replace(/[-_\s]/g, '');
    if (role === 'admin' || role === 'staffb' || role === 'vendor') return { skip: true, key: '' };
    return { skip: false, key: (u.project || u.name || u.seller_name || '').trim().toLowerCase() };
  } catch { return { skip: false, key: '' }; }
}

const loadAllSheets = () => { try { return JSON.parse(localStorage.getItem(LS_SHEETS) || '[]'); } catch { return []; } };

/**
 * Cache CHỈ bản tổng hợp.
 * Bản cũ nhét nguyên sheet (productTypes + tới 20 snapshot history) của MỌI
 * bảng vào đây và chạm trần ~5MB của localStorage — khi đó `setItem` ném lỗi,
 * cache hỏng lặng lẽ và danh sách trắng trơn lúc mất mạng.
 */
const persistAllSheets = (list) => {
  try {
    const lean = list.map(normalizeSheetRow).map(toSummaryRow).filter(Boolean);
    localStorage.setItem(LS_SHEETS, JSON.stringify(lean));
  } catch (err) {
    console.warn('Không cache được danh sách bảng tính giá:', err?.message || err);
  }
};

export default function SetupPriceSection({ onTotalCountChange } = {}) {
  const navigate = useNavigate();
  const [allSheets, setAllSheets] = useState(loadAllSheets);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const aliveRef = useRef(true);

  const { skip, key: projectKey } = _getUserProjectKey();

  const showToast = useCallback((type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  }, []);

  /** Tải lại danh sách từ server. Gọi được nhiều lần — không còn khoá một-lần. */
  const refreshSheets = useCallback(async () => {
    try {
      const res = await priceSheetApi.list();
      const server = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      if (!aliveRef.current) return;
      setAllSheets(server);
      persistAllSheets(server);
    } catch (err) {
      // Chỉ in message: object lỗi kèm cả response đi thẳng ra console của
      // bất kỳ ai mở DevTools trên production.
      console.warn('Không tải được bảng tính giá từ server, dùng cache local:', err?.message || err);
    }
  }, []);

  // ─── Đồng bộ danh sách (mục 16) ──────────────────────────────────────────
  // Trước đây effect này bị khoá bằng `initRef` nên danh sách chỉ tải ĐÚNG MỘT
  // LẦN cả đời component: Seller A lưu bảng, Seller B cùng project không thấy
  // cho tới khi F5. Nay làm mới theo 3 nguồn tín hiệu, bù cho nhau:
  //   1. Pusher  — gần như tức thì, nhưng có thể rớt hoặc chưa cấu hình
  //   2. Quay lại tab — bắt được cả khi Pusher chết
  //   3. Lần mount đầu
  useEffect(() => {
    aliveRef.current = true;
    setAllSheets(loadAllSheets()); // vẽ ngay từ cache local
    refreshSheets();

    const refreshWhenVisible = () => { if (!document.hidden) refreshSheets(); };
    const unsubscribe = subscribePriceSheetChanges(skip ? '' : projectKey, refreshSheets);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      aliveRef.current = false;
      unsubscribe();
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshSheets, skip, projectKey]);

  // Danh sách từ server chỉ có cột tổng hợp; cache localStorage của bản cũ lại
  // là sheet đầy đủ. Quy về một hình dạng ngay tại đây (utils/priceSheetSummary)
  // để phần vẽ bảng bên dưới chỉ có một đường duy nhất.
  const sheets = useMemo(
    () => allSheets
      .map(normalizeSheetRow)
      .filter((row) => row && sheetInProject(row, projectKey, skip)),
    [allSheets, skip, projectKey]
  );

  const filtered = useMemo(
    () => sheets.filter((row) => matchesSheetSearch(row, search)),
    [sheets, search]
  );

  useEffect(() => { onTotalCountChange && onTotalCountChange(sheets.length); }, [sheets, onTotalCountChange]);

  // ── CRUD ──
  /** Ghi vào state + cache local, rồi đẩy lên server.
   *  Ném lại lỗi 409 để nơi gọi (workspace) hiện hộp thoại xung đột. */
  const commitSheet = async (updated, { force = false } = {}) => {
    setAllSheets((prev) => {
      const exists = prev.some((s) => s.id === updated.id);
      const next = exists ? prev.map((s) => (s.id === updated.id ? updated : s)) : [updated, ...prev];
      persistAllSheets(next); // cache local
      return next;
    });

    // Đồng bộ lên server để mọi máy trong project thấy được (409 ném thẳng
    // lên cho workspace hiện hộp thoại xung đột — xem utils/priceSheetCommit).
    const synced = await saveSheetToServer(updated, { force, showToast });
    if (synced.version !== updated.version) {
      // Nhận version mới của server để lần lưu sau gửi đúng — nếu không, lần
      // lưu thứ hai sẽ tự xung đột với chính mình.
      setAllSheets((prev) => {
        const next = prev.map((s) => (s.id === synced.id ? synced : s));
        persistAllSheets(next);
        return next;
      });
    }
    return synced;
  };

  const handleCreate = (sheet) => {
    commitSheet(sheet);
    setShowCreate(false);
    navigate(priceSheetPath(sheet.id)); // bảng mới tạo đã đủ dữ liệu, không cần tải lại
  };

  /**
   * Đường lùi khi server chưa có `/price-sheets/{id}` (deploy frontend trước
   * backend): lúc đó danh sách vẫn là sheet ĐẦY ĐỦ, nên PriceSheetPage mở
   * thẳng bản trong danh sách còn hơn chặn Seller không mở được bảng nào.
   */
  const fullRowFromList = (id) => {
    const raw = allSheets.find((s) => s.id === id);
    return raw && Array.isArray(raw.productTypes) ? raw : null;
  };

  /** Export từ danh sách — phải tải bản đầy đủ trước vì danh sách chỉ có cột tổng hợp. */
  const exportSheet = async (row) => {
    try {
      const res = await priceSheetApi.get(row.id);
      exportSheetToExcel(res.data, showToast);
    } catch (err) {
      const fallback = fullRowFromList(row.id);
      if (fallback) { exportSheetToExcel(fallback, showToast); return; }

      console.warn('Không tải được bảng để export:', err?.message || err);
      showToast('error', 'Không export được', 'Kiểm tra kết nối rồi thử lại.', 4000);
    }
  };

  const handleCopyLink = async (id) => {
    try {
      await copyPriceSheetLink(id);
    } catch (err) {
      console.warn('Copy link bảng tính giá thất bại:', err?.message || err);
      showToast('error', 'Copy link thất bại', 'Kiểm tra quyền truy cập clipboard rồi thử lại.');
    }
  };

  const handleDelete = (sheet) => {
    if (!window.confirm(`Xoá bảng tính giá "${sheet.name}"?`)) return;
    setAllSheets((prev) => { const next = prev.filter((s) => s.id !== sheet.id); persistAllSheets(next); return next; });
    priceSheetApi.remove(sheet.id).catch((err) => {
      console.warn('Xoá trên server thất bại:', err?.message || err);
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <AppToast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <input type="text" placeholder="Tìm bảng / vendor / product..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface, color: HC.ink, outline: 'none', width: 220 }} />
        <button onClick={() => setShowCreate(true)}
          style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
          ＋ Tạo bảng tính giá
        </button>
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
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: 14, border: `1.5px solid ${HC.border}`, background: HC.surface, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})` }}>
                    {['#', 'Bảng tính giá', 'Vendor', 'Product Type', 'Size', 'Khoảng giá', 'Avg Margin', 'Cập nhật', 'Thao tác'].map((h, i) => (
                      <th key={h} style={{ position: 'sticky', top: 0, zIndex: 1, padding: '10px 10px', color: '#fff', fontWeight: 700, textAlign: i === 0 || i > 3 ? 'center' : 'left', whiteSpace: 'nowrap', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sheet, idx) => {
                    const names = sheet.productTypeNames;
                    return (
                      <tr key={sheet.id} style={{ borderBottom: `1px solid ${HC.border}`, background: idx % 2 === 0 ? '#fff' : HC.surface2 }}>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, color: HC.muted, fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: 800, color: HC.ink2 }}>{sheet.name || '—'}</div>
                          {sheet.sourceFile && <div style={{ fontSize: 10, color: HC.muted, marginTop: 2 }}>📄 {sheet.sourceFile}</div>}
                        </td>
                        <td style={{ padding: '10px', fontWeight: 600, color: HC.orange }}>{sheet.vendorRef || '—'}</td>
                        <td style={{ padding: '8px 10px', maxWidth: 240 }}>
                          {names.length === 0 ? <span style={{ color: HC.muted, fontSize: 11 }}>—</span> : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {names.slice(0, 3).map((name, i) => <span key={`${name}-${i}`} style={chip}>{name}</span>)}
                              {names.length > 3 && <span style={{ ...chip, background: HC.orangeLight, color: HC.orangeDark, borderColor: HC.orangeMid }}>+{names.length - 3}</span>}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, background: HC.orangeLight, color: HC.orangeDark, fontWeight: 700, fontSize: 11 }}>{sheet.sizeCount} size</span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: HC.ink2, fontVariantNumeric: 'tabular-nums' }}>
                          {sheet.minPrice != null ? (sheet.minPrice === sheet.maxPrice ? usd(sheet.minPrice) : `${usd(sheet.minPrice)} – ${usd(sheet.maxPrice)}`) : <span style={{ color: HC.muted }}>—</span>}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: sheet.avgMargin != null ? (sheet.avgMargin > 25 ? HC.success : HC.warning) : HC.muted }}>
                          {sheet.avgMargin != null ? pct(sheet.avgMargin, 1) : '—'}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontSize: 11, color: HC.muted, fontVariantNumeric: 'tabular-nums' }}>
                          {fmtVNDate(sheet.updatedAt, '—')}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button onClick={() => navigate(priceSheetPath(sheet.id))}
                              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 800 }}>
                              Mở bảng
                            </button>
                            <button onClick={() => handleCopyLink(sheet.id)} title="Copy link bảng tính giá" style={{ padding: '5px 9px', borderRadius: 6, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.muted, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🔗</button>
                            <button onClick={() => exportSheet(sheet)} title="Export Excel" style={{ padding: '5px 9px', borderRadius: 6, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.muted, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>⬇</button>
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
        </>
      )}

      {showCreate && (
        <CreateSheetModal projectKey={skip ? '' : projectKey} skip={skip} onClose={() => setShowCreate(false)} onCreate={handleCreate} showToast={showToast} />
      )}
    </div>
  );
}

const chip = { padding: '2px 8px', borderRadius: 10, background: HC.surface2, border: `1px solid ${HC.border}`, fontSize: 10, fontWeight: 600, color: HC.ink2, whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' };

const vendorChip = (active) => ({
  fontSize: 12, fontWeight: active ? 700 : 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
  border: `1px solid ${active ? HC.orange : HC.border}`,
  background: active ? HC.orangeLight : HC.surface,
  color: active ? HC.orangeDark : HC.muted, whiteSpace: 'nowrap',
});

// ════════════════════════════════════════════════════════
//  Create modal — gom Product Type từ Thư viện Vendor
// ════════════════════════════════════════════════════════
function CreateSheetModal({ projectKey, skip, onClose, onCreate, showToast }) {
  const [name, setName] = useState('');
  const [libIndex, setLibIndex] = useState(null); // null = đang tải
  const [picked, setPicked] = useState({}); // recordKey -> record
  const [q, setQ] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');

  // Liệt kê theo RECORD (mỗi vendor một dòng riêng) — cùng nguồn/logic với
  // "+ Thêm Product Type" trong workspace (AddProductTypeModal, mục 03/04).
  // Trước đây modal này tự gom theo TÊN phôi (byPT không phân biệt vendor):
  // 2 vendor cùng tên "Poster" bị đè nhau, giữ đúng 1 mã vendor, size lẫn lộn,
  // và không gắn `libRef` nên mở lại bảng vẫn tra nhầm theo tên — sinh đúng
  // bug PR-A3 đã sửa ở nhánh AddProductTypeModal.
  useEffect(() => {
    let alive = true;
    loadVendorLibraryIndex(skip ? '' : projectKey, skip)
      .then((idx) => { if (alive) setLibIndex(idx); })
      .catch((err) => {
        console.error('load library for create', err);
        if (alive) setLibIndex({});
      });
    return () => { alive = false; };
  }, [projectKey, skip]);

  const loading = libIndex == null;
  const all = useMemo(() => listLibraryRecords(libIndex), [libIndex]);
  const vendors = useMemo(
    () => [...new Set(all.map((r) => r.vendorCode).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [all]
  );
  const shown = useMemo(() => listLibraryRecords(libIndex, { q, vendor: vendorFilter }), [libIndex, q, vendorFilter]);

  const toggle = (rec) => setPicked((p) => { const n = { ...p }; if (n[rec.recordKey]) delete n[rec.recordKey]; else n[rec.recordKey] = rec; return n; });

  const create = (fromLibrary) => {
    const nm = name.trim() || 'Bảng tính giá mới';
    const sheet = makeSheet(nm, skip ? '' : projectKey);
    if (fromLibrary) {
      const records = Object.values(picked);
      if (records.length === 0) { showToast('error', 'Chưa chọn', 'Chọn ít nhất một Product Type để gom vào bảng.'); return; }
      sheet.productTypes = records.map((rec) => makeProductTypeFromRecord(rec));
      const vendorCodes = [...new Set(records.map((r) => r.vendorCode).filter(Boolean))];
      sheet.vendorRef = vendorCodes.join(', ');
      sheet._sourceFile = [...new Set(records.map((r) => r.filename))].slice(0, 1)[0] || '';
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

          {/* Lọc theo vendor — chỉ hiện khi thư viện có từ 2 vendor trở lên, cùng
              UX với AddProductTypeModal trong workspace (mục 05). */}
          {vendors.length > 1 && (
            <div role="group" aria-label="Lọc theo vendor" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <button type="button" onClick={() => setVendorFilter('')} aria-pressed={vendorFilter === ''} style={vendorChip(vendorFilter === '')}>Tất cả vendor</button>
              {vendors.map((v) => (
                <button key={v} type="button" onClick={() => setVendorFilter(v)} aria-pressed={vendorFilter === v} style={vendorChip(vendorFilter === v)}>{v}</button>
              ))}
            </div>
          )}

          <div style={{ border: `1px solid ${HC.border}`, borderRadius: 10, maxHeight: 260, overflowY: 'auto', background: HC.surface2 }}>
            {loading ? <div style={{ padding: 30, textAlign: 'center', color: HC.muted }}>Đang tải thư viện…</div>
              : shown.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: HC.muted, fontSize: 13 }}>Không có product type nào trong thư viện của bạn. Vẫn có thể tạo bảng trống.</div>
                : shown.map((rec) => {
                  const on = !!picked[rec.recordKey];
                  return (
                    <div key={rec.recordKey} onClick={() => toggle(rec)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${HC.border}`, cursor: 'pointer', background: on ? HC.orangeLight : 'transparent' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? HC.orange : HC.borderStrong}`, background: on ? HC.orange : HC.surface, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, flexShrink: 0 }}>{on ? '✓' : ''}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: HC.ink2, fontSize: 13 }}>{rec.productType}</div>
                        <div style={{ fontSize: 10.5, color: HC.muted }}>{rec.vendorCode && `Vendor: ${rec.vendorCode} · `}{(rec.sizes || []).length} size · 📄 {rec.filename}</div>
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
