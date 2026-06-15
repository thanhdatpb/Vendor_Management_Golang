// ════════════════════════════════════════════════════════════════════════════
//  VENDOR LIBRARY VIEWER — Thư Viện File (Happy Creative Format)
//  Mỗi file Excel import → lưu localStorage → hiển thị thành card riêng
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useRef, useCallback } from 'react';
import { HC } from '../utils/constants';
import { parseHappyCreativeLibrary } from '../../../utils/vendorExcel';

const LS_KEY = 'VENDOR_LIBRARY_FILES_V1';

const lsGetLibrary = () => {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
};
const lsSetLibrary = (data) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
};

// ── Style helpers ─────────────────────────────────────────────────────────────
const TH = (extra = {}) => ({
  padding: '9px 10px', fontWeight: 800, fontSize: 10, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#fff', background: HC.orangeDark,
  border: `1px solid ${HC.orange}`, fontFamily: "'Nunito',sans-serif",
  verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap', ...extra,
});
const TD = (idx, extra = {}) => ({
  padding: '9px 10px', fontSize: 12, color: HC.ink2, border: `1px solid ${HC.border}`,
  background: idx % 2 === 0 ? HC.surface : HC.surface2,
  fontFamily: "'Nunito Sans',sans-serif", verticalAlign: 'top', ...extra,
});
const fmt$ = (v) => (v !== null && v !== undefined ? `$${Number(v).toFixed(2)}` : '—');
const fmtNA = (v) => (v !== null && v !== undefined && v !== '' ? v : '—');

// ── Section 1 Table ──────────────────────────────────────────────────────────
function GeneralInfoTable({ rows, onSave, readOnly }) {
  const [editIdx, setEditIdx] = useState(-1);
  const [editForm, setEditForm] = useState(null);

  if (!rows || rows.length === 0) return <div style={{ padding: 24, color: HC.muted, textAlign: 'center' }}>Không có dữ liệu thông tin chung.</div>;

  const startEdit = (idx, row) => {
    setEditIdx(idx);
    setEditForm({
      linkFolder: row.linkFolder || '',
      img0: row.images?.[0] || '',
      img1: row.images?.[1] || '',
      img2: row.images?.[2] || '',
      img3: row.images?.[3] || '',
    });
  };

  const saveEdit = (idx) => {
    const newRows = [...rows];
    const images = [editForm.img0, editForm.img1, editForm.img2, editForm.img3].filter(Boolean);
    newRows[idx] = { ...newRows[idx], linkFolder: editForm.linkFolder, images };
    setEditIdx(-1);
    setEditForm(null);
    onSave(newRows);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
        <thead>
          <tr>
            <th style={{ ...TH(), width: 44 }}>Product Type</th>
            {!readOnly && <th style={{ ...TH(), width: 60 }}>Thao tác</th>}
            <th style={{ ...TH(), textAlign: 'left', minWidth: 260 }}>Hình ảnh</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 180 }}>Chất liệu</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 130 }}>Chi tiết Size</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 200 }}>AVG Thời gian (Vendor)</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 160 }}>AVG Thời gian (Thực tế)</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 240 }}>Notes</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 160 }}>Link Folder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isEditing = editIdx === i;
            return (
              <tr key={i}>
                <td style={{ ...TD(i), fontWeight: 900, color: HC.orangeDark, textAlign: 'center' }}>{r.kyHieu || '—'}</td>
                {!readOnly && (
                  <td style={{ ...TD(i), textAlign: 'center' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button onClick={() => saveEdit(i)} style={{ padding: '4px 8px', borderRadius: 4, background: HC.success, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Lưu</button>
                        <button onClick={() => setEditIdx(-1)} style={{ padding: '4px 8px', borderRadius: 4, background: HC.muted, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Hủy</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(i, r)} style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(212,160,23,0.15)', color: HC.gold, border: `1px solid ${HC.goldLight}`, cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>✏️ Sửa</button>
                    )}
                  </td>
                )}
                <td style={{ ...TD(i) }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input type="text" placeholder="URL Hình 1" value={editForm.img0} onChange={e => setEditForm(p => ({ ...p, img0: e.target.value }))} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: `1px solid ${HC.border}` }} />
                      <input type="text" placeholder="URL Hình 2" value={editForm.img1} onChange={e => setEditForm(p => ({ ...p, img1: e.target.value }))} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: `1px solid ${HC.border}` }} />
                      <input type="text" placeholder="URL Hình 3" value={editForm.img2} onChange={e => setEditForm(p => ({ ...p, img2: e.target.value }))} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: `1px solid ${HC.border}` }} />
                      <input type="text" placeholder="URL Hình 4" value={editForm.img3} onChange={e => setEditForm(p => ({ ...p, img3: e.target.value }))} style={{ padding: 4, fontSize: 10, borderRadius: 4, border: `1px solid ${HC.border}` }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.images && r.images.length > 0 ? r.images.map((img, idx) => (
                        <a key={idx} href={img} target="_blank" rel="noreferrer">
                          <img src={img} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: `1px solid ${HC.border}` }} />
                        </a>
                      )) : <span style={{ color: HC.muted, fontSize: 11, fontStyle: 'italic' }}>Không có ảnh</span>}
                    </div>
                  )}
                </td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{fmtNA(r.chatLieu)}</td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{fmtNA(r.chiTietSize)}</td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.5, color: HC.success }}>{fmtNA(r.avgTimeVendor)}</td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.5, color: HC.warning }}>{fmtNA(r.avgTimeActual)}</td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{fmtNA(r.notes)}</td>
                <td style={{ ...TD(i) }}>
                  {isEditing ? (
                    <input type="text" placeholder="Link Folder..." value={editForm.linkFolder} onChange={e => setEditForm(p => ({ ...p, linkFolder: e.target.value }))} style={{ width: '100%', padding: 6, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}` }} />
                  ) : (
                    r.linkFolder ? <a href={r.linkFolder} target="_blank" rel="noreferrer" style={{ color: HC.orangeDark, textDecoration: 'underline', wordBreak: 'break-all' }}>{r.linkFolder}</a> : <span style={{ color: HC.muted2 }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Section 2 Table ──────────────────────────────────────────────────────────
function PricingTable({ rows }) {
  if (!rows || rows.length === 0) return <div style={{ padding: 24, color: HC.muted, textAlign: 'center' }}>Không có dữ liệu giá.</div>;

  const shipMethods = [
    { label: 'Economy', priceKey: 'eco_price', totalKey: 'eco_total' },
    { label: 'Ground', priceKey: 'ground_price', totalKey: 'ground_total' },
    { label: 'Express', priceKey: 'express_price', totalKey: 'express_total' },
    { label: '2 Days', priceKey: 'twoday_price', totalKey: 'twoday_total' },
    { label: 'Overnight', priceKey: 'overnight_price', totalKey: 'overnight_total' },
  ];

  const shipBg = ['#1d6b3a', HC.orangeDark, '#1e4fa0', '#7c3aed', '#b91c1c'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...TH(), width: 44 }}>Ký hiệu</th>
            <th rowSpan={2} style={{ ...TH(), textAlign: 'left', minWidth: 160 }}>Product Type</th>
            <th colSpan={2} style={{ ...TH() }}>Detail</th>
            <th colSpan={2} style={{ ...TH() }}>Pricing</th>
            {shipMethods.map((m, si) => (
              <th key={m.label} colSpan={2} style={{ ...TH(), background: shipBg[si] }}>{m.label}</th>
            ))}
          </tr>
          <tr>
            <th style={{ ...TH(), minWidth: 80 }}>Size</th>
            <th style={{ ...TH(), minWidth: 80 }}>Optional</th>
            <th style={{ ...TH({ background: '#b45309' }), minWidth: 70 }}>P1</th>
            <th style={{ ...TH({ background: '#b45309' }), minWidth: 70 }}>P2</th>
            {shipMethods.map((m, si) => [
              <th key={`${m.label}-price`} style={{ ...TH({ background: shipBg[si], opacity: 0.85 }), minWidth: 80 }}>Price Ship</th>,
              <th key={`${m.label}-total`} style={{ ...TH({ background: shipBg[si] }), minWidth: 90 }}>Total (fulfill)</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ ...TD(i), fontWeight: 900, color: HC.orangeDark, textAlign: 'center' }}>{r.kyHieu || '—'}</td>
              <td style={{ ...TD(i), fontWeight: 700 }}>{r.productType || '—'}</td>
              <td style={{ ...TD(i), textAlign: 'center' }}>{fmtNA(r.size)}</td>
              <td style={{ ...TD(i), textAlign: 'center' }}>{fmtNA(r.optional)}</td>
              <td style={{ ...TD(i), textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{fmt$(r.pricing1)}</td>
              <td style={{ ...TD(i), textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{fmt$(r.pricing2)}</td>
              {shipMethods.map((m) => [
                <td key={`${m.label}-price`} style={{ ...TD(i), textAlign: 'right', color: HC.muted }}>{fmt$(r[m.priceKey])}</td>,
                <td key={`${m.label}-total`} style={{ ...TD(i), textAlign: 'right', fontWeight: 700, color: r[m.totalKey] != null ? HC.success : HC.muted2 }}>{fmt$(r[m.totalKey])}</td>,
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Single Library File Card ──────────────────────────────────────────────────
function LibraryCard({ entry, onDelete, onUpdate, readOnly }) {
  const [activeSection, setActiveSection] = useState('general');
  const [expanded, setExpanded] = useState(true);

  const importDate = new Date(entry.importedAt).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{
      borderRadius: 16, border: `1.5px solid ${HC.border}`,
      boxShadow: HC.shadow, overflow: 'hidden', marginBottom: 20,
      transition: 'box-shadow 0.2s',
    }}>
      {/* Card Header */}
      <div style={{
        padding: '14px 20px',
        background: `linear-gradient(135deg, ${HC.ink}, #2d1a00)`,
        display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
      }} onClick={() => setExpanded(p => !p)}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
        }}>📄</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Nunito',sans-serif", marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.filename}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 10px', borderRadius: 99, background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>
              {entry.title}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>📅 {importDate}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {entry.generalInfo?.length || 0} sản phẩm · {entry.pricing?.length || 0} dòng giá
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {!readOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.15)', color: '#fca5a5', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              title="Xóa file này"
            >🗑 Xóa</button>
          )}
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', transition: 'transform 0.2s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div>
          {/* Section Tabs */}
          <div style={{ display: 'flex', gap: 0, background: HC.cream, borderBottom: `1.5px solid ${HC.border}` }}>
            {[
              { id: 'general', label: '📋 Thông tin chung về phôi', count: entry.generalInfo?.length },
              { id: 'pricing', label: '💰 Về giá', count: entry.pricing?.length },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveSection(tab.id)} style={{
                padding: '11px 20px', border: 'none', borderBottom: activeSection === tab.id ? `2.5px solid ${HC.orange}` : '2.5px solid transparent',
                background: activeSection === tab.id ? HC.surface : 'transparent',
                color: activeSection === tab.id ? HC.orangeDark : HC.muted,
                fontSize: 12, fontWeight: activeSection === tab.id ? 900 : 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Nunito',sans-serif", transition: 'all 0.15s',
              }}>
                {tab.label}
                <span style={{ padding: '1px 8px', borderRadius: 99, background: activeSection === tab.id ? HC.orangeLight : HC.border, color: activeSection === tab.id ? HC.orangeDark : HC.muted, fontSize: 10, fontWeight: 800 }}>
                  {tab.count ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Section Content */}
          <div style={{ background: HC.surface }}>
            {activeSection === 'general' && <GeneralInfoTable rows={entry.generalInfo} onSave={(newRows) => onUpdate({ ...entry, generalInfo: newRows })} readOnly={readOnly} />}
            {activeSection === 'pricing' && <PricingTable rows={entry.pricing} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VendorLibraryViewer({ readOnly = false }) {
  const [libraryFiles, setLibraryFiles] = useState(() => lsGetLibrary());
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleImport = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!files.length) return;

    setImporting(true);
    setImportErrors([]);
    const errors = [];
    const newEntries = [];

    for (const file of files) {
      if (!['xlsx', 'xls'].includes(file.name.split('.').pop().toLowerCase())) {
        errors.push(`${file.name}: Chỉ hỗ trợ file .xlsx / .xls`);
        continue;
      }
      try {
        const result = await parseHappyCreativeLibrary(file);
        newEntries.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          filename: file.name,
          importedAt: new Date().toISOString(),
          title: result.title,
          generalInfo: result.generalInfo,
          pricing: result.pricing,
        });
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (newEntries.length > 0) {
      setLibraryFiles(prev => {
        // Tránh trùng tên file — cập nhật nếu đã có
        const map = Object.fromEntries(prev.map(e => [e.filename, e]));
        newEntries.forEach(ne => { map[ne.filename] = ne; });
        const updated = Object.values(map);
        lsSetLibrary(updated);
        return updated;
      });
      showToast('success', `✅ Import ${newEntries.length} file thành công${errors.length ? `, ${errors.length} lỗi` : ''}`);
    }

    if (errors.length > 0 && newEntries.length === 0) {
      showToast('error', `❌ Import thất bại`);
    }

    setImportErrors(errors);
    setImporting(false);
  }, []);

  const handleDelete = useCallback((id) => {
    if (!window.confirm('Xóa file thư viện này?')) return;
    setLibraryFiles(prev => {
      const updated = prev.filter(e => e.id !== id);
      lsSetLibrary(updated);
      return updated;
    });
    showToast('success', '🗑 Đã xóa file thư viện');
  }, []);

  const handleUpdateEntry = useCallback((updatedEntry) => {
    setLibraryFiles(prev => {
      const updated = prev.map(e => e.id === updatedEntry.id ? updatedEntry : e);
      lsSetLibrary(updated);
      return updated;
    });
    showToast('success', '💾 Đã lưu thay đổi cục bộ');
  }, []);

  const handleClearAll = () => {
    if (!window.confirm(`Xóa toàn bộ ${libraryFiles.length} file thư viện? Hành động không thể hoàn tác.`)) return;
    setLibraryFiles([]);
    lsSetLibrary([]);
    showToast('success', '🗑 Đã xóa toàn bộ thư viện');
  };

  return (
    <div>
      {/* Hidden file input — multiple */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        style={{ display: 'none' }}
        onChange={handleImport}
      />

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1500, animation: 'slideInRight 0.3s ease-out' }}>
          <div style={{
            background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : `linear-gradient(135deg, #dc2626, #b91c1c)`,
            borderRadius: 12, boxShadow: HC.shadowStrong, minWidth: 260, maxWidth: 380,
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{toast.type === 'success' ? '✅' : '❌'}</span>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>{toast.msg}</div>
            <button onClick={() => setToast(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
            📚 Tất cả Vendor
          </div>
          <span style={{ padding: '2px 12px', borderRadius: 99, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>
            {libraryFiles.length} file
          </span>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {libraryFiles.length > 0 && (
              <button onClick={handleClearAll} style={{ padding: '9px 16px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#dc2626', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                🗑 Xóa tất cả
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: importing ? HC.muted2 : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 12, fontWeight: 800, cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {importing ? '⟳ Đang import...' : '📥 Import thư viện Excel'}
            </button>
          </div>
        )}
      </div>

      {/* Import hint */}
      <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 10, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, fontSize: 12, color: HC.brown }}>
        💡 Hỗ trợ import nhiều file cùng lúc (định dạng <b>Happy Creative</b>). Mỗi file hiển thị riêng với 2 bảng: <b>Thông tin chung về phôi</b> và <b>Về giá</b>. Dữ liệu được lưu cục bộ.
      </div>

      {/* Import Errors */}
      {importErrors.length > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca' }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: '#b91c1c', marginBottom: 6 }}>⚠️ Có {importErrors.length} file lỗi:</div>
          {importErrors.map((err, i) => (
            <div key={i} style={{ fontSize: 11, color: '#991b1b', marginTop: 3 }}>• {err}</div>
          ))}
        </div>
      )}

      {/* Library list */}
      {libraryFiles.length === 0 ? (
        <div style={{ padding: '60px 40px', textAlign: 'center', background: HC.surface, borderRadius: 16, border: `1.5px dashed ${HC.border}` }}>
          <div style={{ fontSize: 52, marginBottom: 16, opacity: 0.4 }}>📚</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: HC.muted, marginBottom: 8 }}>Chưa có file thư viện nào</div>
          {!readOnly && (
            <>
              <div style={{ fontSize: 12, color: HC.muted2, marginBottom: 24 }}>Nhấn <b style={{ color: HC.orangeDark }}>Import thư viện Excel</b> để import file Happy Creative format</div>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                📥 Import thư viện Excel
              </button>
            </>
          )}
        </div>
      ) : (
        libraryFiles.map(entry => (
          <LibraryCard key={entry.id} entry={entry} onDelete={handleDelete} onUpdate={handleUpdateEntry} readOnly={readOnly} />
        ))
      )}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
