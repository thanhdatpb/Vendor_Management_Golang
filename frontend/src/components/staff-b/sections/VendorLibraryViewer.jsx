// ════════════════════════════════════════════════════════════════════════════
//  VENDOR LIBRARY VIEWER — Thư Viện File (Happy Creative Format)
//  Mỗi file Excel import → lưu localStorage → hiển thị thành card riêng
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { HC } from '../utils/constants';
import { parseHappyCreativeLibrary } from '../../../utils/vendorExcel';
import { vendorLibraryApi } from '../../../services/api';

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
function GeneralInfoTable({ rows, onSave, readOnly, selectable, selectedIds, onSelectRow }) {
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
            {selectable && <th style={{ ...TH(), width: 36, textAlign: 'center' }}>✓</th>}
            {selectable && <th style={{ ...TH(), width: 60, textAlign: 'center' }}>ID</th>}
            <th style={{ ...TH(), width: 44 }}>Product Type</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 260 }}>Hình ảnh</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 180 }}>Chất liệu</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 130 }}>Chi tiết Size</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 200 }}>AVG Thời gian (Vendor)</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 160 }}>AVG Thời gian (Thực tế)</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 240 }}>Notes</th>
            <th style={{ ...TH(), textAlign: 'left', minWidth: 160 }}>Link Folder</th>
            {!readOnly && <th style={{ ...TH(), width: 60 }}>Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isEditing = editIdx === i;
            return (
              <tr key={i}>
                {selectable && (
                  <td style={{ ...TD(i), textAlign: 'center', cursor: 'pointer' }} onClick={() => onSelectRow(r.id)}>
                    <input type="checkbox" checked={selectedIds?.has(r.id)} onChange={() => onSelectRow(r.id)} style={{ cursor: 'pointer' }} />
                  </td>
                )}
                {selectable && <td style={{ ...TD(i), textAlign: 'center', fontWeight: 900, color: HC.muted, fontSize: 11 }}>{r.id ? r.id.split('-').slice(1).join('-') : '—'}</td>}
                <td style={{ ...TD(i), fontWeight: 900, color: HC.orangeDark, textAlign: 'center' }}>{r.kyHieu || '—'}</td>
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
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {r.chiTietSizeImage && (
                    <a href={r.chiTietSizeImage} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: r.chiTietSize ? 8 : 0 }}>
                      <img src={r.chiTietSizeImage} alt="Size Guide" style={{ width: '100%', maxWidth: 160, borderRadius: 6, border: `1px solid ${HC.border}`, objectFit: 'contain' }} />
                    </a>
                  )}
                  {r.chiTietSize ? r.chiTietSize : (!r.chiTietSizeImage ? '—' : '')}
                </td>
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
function LibraryCard({ entry, onDelete, onUpdate, readOnly, selectable, selectedIds, onSelectRow }) {
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
            {activeSection === 'general' && <GeneralInfoTable rows={entry.generalInfo} onSave={(newRows) => onUpdate({ ...entry, generalInfo: newRows })} readOnly={readOnly} selectable={selectable} selectedIds={selectedIds} onSelectRow={onSelectRow} />}
            {activeSection === 'pricing' && <PricingTable rows={entry.pricing} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VendorLibraryViewer({ readOnly = false, mode = 'all', selectable = false, selectedIds, onSelectRow, onLibraryLoaded }) {
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileInputRef = useRef(null);

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await vendorLibraryApi.get(mode);
      let data = Array.isArray(res.data) ? res.data : [];

      if (readOnly && mode === 'all') {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const MOCK_PRODUCTS = JSON.parse(localStorage.getItem('MOCK_PRODUCTS') || '[]');
        
        const myProductIds = new Set();
        MOCK_PRODUCTS.forEach(p => {
          if (user.role === 'admin' || p.seller_name === user.sellerName || p.project === user.project) {
            myProductIds.add(String(p.id));
          }
        });

        const LS_PRODUCT_VENDORS = 'STAFF_PRODUCT_VENDORS_V1';
        const assigned = JSON.parse(localStorage.getItem(LS_PRODUCT_VENDORS) || '{}');
        const assignedIds = new Set();
        
        Object.entries(assigned).forEach(([pId, list]) => {
          if (myProductIds.has(String(pId))) {
            list.forEach(v => {
              if (v.is_excel) assignedIds.add(v.id);
            });
          }
        });

        data = data.map(file => {
          if (!file.generalInfo) return file;
          return { ...file, generalInfo: file.generalInfo.filter(r => assignedIds.has(r.id)) };
        }).filter(file => file.generalInfo && file.generalInfo.length > 0);
      }

      setLibraryFiles(data);
      if (onLibraryLoaded) onLibraryLoaded(data);
    } catch (err) {
      console.error('Error fetching vendor library:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const saveLibrary = async (newData) => {
    try {
      await vendorLibraryApi.save(newData, mode);
      setLibraryFiles(newData);
      if (onLibraryLoaded) onLibraryLoaded(newData);
    } catch (err) {
      console.error('Error saving vendor library:', err);
      alert('Có lỗi xảy ra khi lưu dữ liệu!');
    }
  };

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
      const map = Object.fromEntries(libraryFiles.map(e => [e.filename, e]));
      newEntries.forEach(ne => { map[ne.filename] = ne; });
      const updated = Object.values(map);
      await saveLibrary(updated);
      showToast('success', `✅ Import ${newEntries.length} file thành công${errors.length ? `, ${errors.length} lỗi` : ''}`);
    }

    if (errors.length > 0 && newEntries.length === 0) {
      showToast('error', `❌ Import thất bại`);
    }

    setImportErrors(errors);
    setImporting(false);
  }, [libraryFiles]);

  const handleDelete = (id) => {
    setDeleteConfirm({ type: 'single', id });
  };

  const handleClearAll = () => {
    setDeleteConfirm({ type: 'all' });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'all') {
      await saveLibrary([]);
      showToast('success', '🗑 Đã xóa toàn bộ thư viện');
    } else if (deleteConfirm.type === 'single') {
      const updated = libraryFiles.filter(e => e.id !== deleteConfirm.id);
      await saveLibrary(updated);
      showToast('success', '🗑 Đã xóa file thư viện');
    }
    setDeleteConfirm(null);
  };

  const handleUpdateEntry = async (updatedEntry) => {
    const updated = libraryFiles.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    await saveLibrary(updated);
    showToast('success', '💾 Đã lưu thay đổi');
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
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: HC.muted }}>Đang tải thư viện...</div>
      ) : libraryFiles.length === 0 ? (
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
          <LibraryCard key={entry.id} entry={entry} onDelete={handleDelete} onUpdate={handleUpdateEntry} readOnly={readOnly} selectable={selectable} selectedIds={selectedIds} onSelectRow={onSelectRow} />
        ))
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 400, boxShadow: HC.shadowStrong, animation: 'scaleIn 0.2s ease-out' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#dc2626', fontFamily: "'Nunito',sans-serif" }}>Xác nhận xóa</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: HC.muted, lineHeight: 1.5 }}>
              {deleteConfirm.type === 'all' 
                ? `Bạn có chắc chắn muốn xóa toàn bộ ${libraryFiles.length} file thư viện? Hành động này không thể hoàn tác.`
                : 'Bạn có chắc chắn muốn xóa file thư viện này? Hành động này không thể hoàn tác.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', borderRadius: 8, background: HC.surface, border: `1px solid ${HC.border}`, color: HC.ink, cursor: 'pointer', fontWeight: 700 }}>Hủy</button>
              <button onClick={executeDelete} style={{ padding: '8px 16px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Xác nhận xóa</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
