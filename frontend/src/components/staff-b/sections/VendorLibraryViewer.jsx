// ════════════════════════════════════════════════════════════════════════════
//  VENDOR LIBRARY VIEWER — Thư Viện File (Happy Creative Format)
//  Mỗi file Excel import → lưu localStorage → hiển thị thành card riêng
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { HC } from '../utils/constants';
import { parseHappyCreativeLibrary } from '../../../utils/vendorExcel';
import { vendorLibraryApi } from '../../../services/api';
import AppToast from '../../shared/AppToast';

// ── Style helpers ─────────────────────────────────────────────────────────────
const TH = (extra = {}) => ({
  padding: '7px 8px', fontWeight: 800, fontSize: 9.5, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: '#fff', background: HC.orangeDark,
  border: `1px solid ${HC.orange}`, fontFamily: "'Nunito',sans-serif",
  verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap', ...extra,
});
const TD = (idx, extra = {}) => ({
  padding: '7px 8px', fontSize: 12, color: HC.ink2, border: `1px solid ${HC.border}`,
  background: idx % 2 === 0 ? HC.surface : HC.surface2,
  fontFamily: "'Nunito Sans',sans-serif", verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word', ...extra,
});
const fmt$ = (v) => (v !== null && v !== undefined ? `$${Number(v).toFixed(2)}` : '—');
const fmtNA = (v) => (v !== null && v !== undefined && v !== '' ? v : '—');

// ── Section 1 Table ──────────────────────────────────────────────────────────
function GeneralInfoTable({ rows, onSave, readOnly, selectable, selectedIds, onSelectRow, onSelectAll, bestSellerIds, toggleBestSeller, mode }) {
  const [editIdx, setEditIdx] = useState(-1);
  const [editForm, setEditForm] = useState(null);

  if (!rows || rows.length === 0) return <div style={{ padding: 24, color: HC.muted, textAlign: 'center' }}>Không có dữ liệu thông tin chung.</div>;

  const startEdit = (idx, row) => {
    setEditIdx(idx);
    setEditForm({
      vendorName: row.vendorName || '',
      productType: row.productType || '',
      kyHieu: row.kyHieu || '',
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
    newRows[idx] = { ...newRows[idx], vendorName: editForm.vendorName, productType: editForm.productType, kyHieu: editForm.kyHieu, linkFolder: editForm.linkFolder, images };
    setEditIdx(-1);
    setEditForm(null);
    onSave(newRows);
  };

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
      <thead>
        <tr>
          {!readOnly && <th style={{ ...TH({ background: '#8B6914' }), width: '3%', textAlign: 'center' }} title="Đánh dấu Best Seller">⭐</th>}
          {selectable && (() => {
            const allChecked = rows.length > 0 && rows.every(r => selectedIds?.has(r.id));
            const someChecked = !allChecked && rows.some(r => selectedIds?.has(r.id));
            return (
              <th style={{ ...TH(), width: '3%', textAlign: 'center', cursor: 'pointer' }} onClick={onSelectAll} title={allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả trong file này'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${allChecked ? '#fff' : 'rgba(255,255,255,0.6)'}`, background: allChecked ? '#fff' : someChecked ? 'rgba(255,255,255,0.3)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {allChecked && <span style={{ color: HC.orangeDark, fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    {someChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>−</span>}
                  </div>
                </div>
              </th>
            );
          })()}
          <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Vendor Name</th>
          <th style={{ ...TH(), width: '10%', textAlign: 'left' }}>Product Type</th>
          <th style={{ ...TH(), width: '4%' }}>Ký hiệu</th>
          <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Hình ảnh</th>
          <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Chất liệu</th>
          <th style={{ ...TH(), width: '7%', textAlign: 'left' }}>Chi tiết Size</th>
          <th style={{ ...TH(), width: '10%', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.3 }}>AVG TG (Vendor)</th>
          <th style={{ ...TH(), width: '8%', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.3 }}>AVG TG (Thực tế)</th>
          <th style={{ ...TH(), width: '16%', textAlign: 'left' }}>Notes</th>
          <th style={{ ...TH(), width: '8%', textAlign: 'left' }}>Link Folder</th>
          {!readOnly && <th style={{ ...TH(), width: '5%' }}>Thao tác</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isEditing = editIdx === i;
          const isBestSeller = bestSellerIds?.has(r.id);
          return (
            <tr key={i} style={{ background: isBestSeller ? 'rgba(255,215,0,0.07)' : undefined }}>
              {!readOnly && (
                <td style={{ ...TD(i), textAlign: 'center', cursor: 'pointer', background: isBestSeller ? 'rgba(255,215,0,0.15)' : undefined, transition: 'background 0.2s' }} onClick={() => toggleBestSeller && toggleBestSeller(r.id)} title={isBestSeller ? 'Bỏ đánh dấu Best Seller' : 'Đánh dấu Best Seller'}>
                  <div style={{ fontSize: 16, transition: 'all 0.25s ease', transform: isBestSeller ? 'scale(1.25)' : 'scale(1)', opacity: isBestSeller ? 1 : 0.15, filter: isBestSeller ? 'drop-shadow(0 0 5px rgba(255,200,0,0.9))' : 'none' }}>⭐</div>
                </td>
              )}
              {selectable && (
                <td style={{ ...TD(i), textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => onSelectRow(r.id)}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selectedIds?.has(r.id) ? HC.orange : HC.muted2}`, background: selectedIds?.has(r.id) ? HC.orange : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', transition: 'all 0.15s', flexShrink: 0 }}>
                    {selectedIds?.has(r.id) && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                </td>
              )}
              <td style={{ ...TD(i) }}>
                {isEditing ? (
                  <input type="text" placeholder="Vendor Name..." value={editForm.vendorName} onChange={e => setEditForm(p => ({ ...p, vendorName: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                ) : (
                  r.vendorName
                    ? <span style={{ fontWeight: 700, color: HC.ink }}>{r.vendorName}</span>
                    : <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' }}>N/A</span>
                )}
              </td>
              <td style={{ ...TD(i) }}>
                {isEditing ? (
                  <input type="text" placeholder="Product Type..." value={editForm.productType} onChange={e => setEditForm(p => ({ ...p, productType: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                ) : (
                  r.productType
                    ? <span style={{ fontWeight: 700, color: HC.ink }}>{r.productType}</span>
                    : <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' }}>N/A</span>
                )}
              </td>
              <td style={{ ...TD(i), textAlign: 'center' }}>
                {isEditing ? (
                  <input type="text" placeholder="A, B..." value={editForm.kyHieu} onChange={e => setEditForm(p => ({ ...p, kyHieu: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'center', fontWeight: 900, color: HC.orangeDark, boxSizing: 'border-box' }} />
                ) : (
                  r.kyHieu
                    ? <span style={{ fontWeight: 900, color: HC.orangeDark }}>{r.kyHieu}</span>
                    : <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' }}>N/A</span>
                )}
              </td>
              <td style={{ ...TD(i) }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {['img0','img1','img2','img3'].map((k, n) => (
                      <input key={k} type="text" placeholder={`URL Hình ${n+1}`} value={editForm[k]} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} style={{ width: '100%', padding: 3, fontSize: 10, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {r.images && r.images.length > 0 ? r.images.map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noreferrer">
                        <img src={img} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: `1px solid ${HC.border}` }} />
                      </a>
                    )) : <span style={{ color: HC.muted, fontSize: 10, fontStyle: 'italic' }}>Không có ảnh</span>}
                  </div>
                )}
              </td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{fmtNA(r.chatLieu)}</td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                {r.chiTietSizeImage && (
                  <a href={r.chiTietSizeImage} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: r.chiTietSize ? 6 : 0 }}>
                    <img src={r.chiTietSizeImage} alt="Size Guide" loading="lazy" style={{ width: '100%', maxWidth: '100%', borderRadius: 4, border: `1px solid ${HC.border}`, objectFit: 'contain' }} />
                  </a>
                )}
                {r.chiTietSize ? r.chiTietSize : (!r.chiTietSizeImage ? '—' : '')}
              </td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4, color: HC.success }}>{fmtNA(r.avgTimeVendor)}</td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4, color: HC.warning }}>{fmtNA(r.avgTimeActual)}</td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{fmtNA(r.notes)}</td>
              <td style={{ ...TD(i) }}>
                {isEditing ? (
                  <input type="text" placeholder="Link Folder..." value={editForm.linkFolder} onChange={e => setEditForm(p => ({ ...p, linkFolder: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                ) : (
                  r.linkFolder
                    ? <a href={r.linkFolder} target="_blank" rel="noreferrer" title={r.linkFolder} style={{ color: HC.orangeDark, textDecoration: 'underline', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔗 Folder</a>
                    : <span style={{ color: HC.muted2 }}>—</span>
                )}
              </td>
              {!readOnly && (
                <td style={{ ...TD(i), textAlign: 'center' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button onClick={() => saveEdit(i)} style={{ padding: '4px 6px', borderRadius: 4, background: HC.success, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Lưu</button>
                      <button onClick={() => setEditIdx(-1)} style={{ padding: '4px 6px', borderRadius: 4, background: HC.muted, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Hủy</button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(i, r)} style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(212,160,23,0.15)', color: HC.gold, border: `1px solid ${HC.goldLight}`, cursor: 'pointer', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>✏️ Sửa</button>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Section 2 Table ──────────────────────────────────────────────────────────
function PricingTable({ rows, onSave, readOnly }) {
  const [editIdx, setEditIdx] = useState(-1);
  const [editForm, setEditForm] = useState(null);

  if (!rows || rows.length === 0) return <div style={{ padding: 24, color: HC.muted, textAlign: 'center' }}>Không có dữ liệu giá.</div>;

  const startEdit = (idx, row) => {
    setEditIdx(idx);
    setEditForm({ kyHieu: row.kyHieu || '', productType: row.productType || '' });
  };

  const saveEdit = (idx) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], kyHieu: editForm.kyHieu, productType: editForm.productType };
    setEditIdx(-1);
    setEditForm(null);
    if (onSave) onSave(newRows);
  };

  const shipMethods = [
    { label: 'Economy', priceKey: 'eco_price', totalKey: 'eco_total' },
    { label: 'Ground', priceKey: 'ground_price', totalKey: 'ground_total' },
    { label: 'Express', priceKey: 'express_price', totalKey: 'express_total' },
    { label: '2 Days', priceKey: 'twoday_price', totalKey: 'twoday_total' },
    { label: 'Overnight', priceKey: 'overnight_price', totalKey: 'overnight_total' },
  ];

  const shipBg = ['#1d6b3a', HC.orangeDark, '#1e4fa0', '#7c3aed', '#b91c1c'];
  const naStyle = { background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...TH(), width: 54 }}>Ký hiệu</th>
            <th rowSpan={2} style={{ ...TH(), textAlign: 'left', minWidth: 160 }}>Product Type</th>
            <th colSpan={2} style={{ ...TH() }}>Detail</th>
            <th colSpan={2} style={{ ...TH() }}>Pricing</th>
            {shipMethods.map((m, si) => (
              <th key={m.label} colSpan={2} style={{ ...TH(), background: shipBg[si] }}>{m.label}</th>
            ))}
            {!readOnly && <th rowSpan={2} style={{ ...TH(), width: 60 }}>Thao tác</th>}
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
          {rows.map((r, i) => {
            const isEditing = editIdx === i;
            return (
              <tr key={i}>
                <td style={{ ...TD(i), textAlign: 'center' }}>
                  {isEditing ? (
                    <input type="text" placeholder="A, B..." value={editForm.kyHieu} onChange={e => setEditForm(p => ({ ...p, kyHieu: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'center', fontWeight: 900, color: HC.orangeDark }} />
                  ) : (
                    r.kyHieu ? <span style={{ fontWeight: 900, color: HC.orangeDark }}>{r.kyHieu}</span> : <span style={naStyle}>N/A</span>
                  )}
                </td>
                <td style={{ ...TD(i) }}>
                  {isEditing ? (
                    <input type="text" placeholder="Product Type..." value={editForm.productType} onChange={e => setEditForm(p => ({ ...p, productType: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}` }} />
                  ) : (
                    r.productType ? <span style={{ fontWeight: 700 }}>{r.productType}</span> : <span style={naStyle}>N/A</span>
                  )}
                </td>
                <td style={{ ...TD(i), textAlign: 'center' }}>{fmtNA(r.size)}</td>
                <td style={{ ...TD(i), textAlign: 'center' }}>{fmtNA(r.optional)}</td>
                <td style={{ ...TD(i), textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{fmt$(r.pricing1)}</td>
                <td style={{ ...TD(i), textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{fmt$(r.pricing2)}</td>
                {shipMethods.map((m) => [
                  <td key={`${m.label}-price`} style={{ ...TD(i), textAlign: 'right', color: HC.muted }}>{fmt$(r[m.priceKey])}</td>,
                  <td key={`${m.label}-total`} style={{ ...TD(i), textAlign: 'right', fontWeight: 700, color: r[m.totalKey] != null ? HC.success : HC.muted2 }}>{fmt$(r[m.totalKey])}</td>,
                ])}
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

// ── Single Library File Card ──────────────────────────────────────────────────
function LibraryCard({ entry, idx = 0, onDelete, onUpdate, readOnly, selectable, selectedIds, onSelectRow, onSelectAll, bestSellerIds, toggleBestSeller, mode, highlighted }) {
  const [activeSection, setActiveSection] = useState('general');
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);

  const fileRowIds = entry.generalInfo?.map(r => r.id) || [];
  const selectedInFile = fileRowIds.filter(id => selectedIds?.has(id)).length;
  const allInFileSelected = fileRowIds.length > 0 && fileRowIds.every(id => selectedIds?.has(id));

  const handleSelectAllInFile = () => {
    if (onSelectAll) onSelectAll(fileRowIds);
  };

  const importDate = new Date(entry.importedAt).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        border: `1.5px solid ${highlighted ? HC.orange : hovered ? HC.orangeMid : HC.border}`,
        boxShadow: highlighted ? `0 0 0 3px ${HC.orangeGlow}, 0 6px 20px rgba(0,0,0,0.09)` : hovered ? '0 6px 20px rgba(0,0,0,0.09)' : '0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden', marginBottom: 14,
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.18s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        background: highlighted ? HC.orangePale || '#fffbeb' : '#fff',
      }}
    >
      {/* Card Header */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{
          padding: '10px 14px',
          background: hovered ? HC.orangeLight : '#fff',
          borderLeft: `3px solid ${HC.orange}`,
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          transition: 'background 0.18s',
        }}
      >
        {/* File icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: HC.orangeLight,
          border: `1px solid ${HC.orangeMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, flexShrink: 0,
        }}>📄</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Filename */}
          <div style={{
            fontWeight: 800, fontSize: 12.5, color: HC.ink,
            fontFamily: "'Nunito',sans-serif", marginBottom: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.filename}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {mode === 'all' && entry.sourceTab === 'new_products' && (
              <span style={{ padding: '1px 6px', borderRadius: 4, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mới</span>
            )}
            <span style={{
              padding: '2px 8px', borderRadius: 99,
              background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`,
              color: HC.orangeDark, fontSize: 9.5, fontWeight: 800,
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>
              {entry.title}
            </span>
            <span style={{ fontSize: 10.5, color: HC.muted }}>
              {importDate}
            </span>
            <span style={{ fontSize: 10.5, color: HC.muted2 }}>
              {entry.generalInfo?.length || 0} sản phẩm · {entry.pricing?.length || 0} dòng giá
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {selectable && fileRowIds.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSelectAllInFile(); }}
              title={allInFileSelected ? 'Bỏ chọn tất cả trong file này' : 'Chọn tất cả trong file này'}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${allInFileSelected ? HC.orange : HC.border}`,
                background: allInFileSelected ? HC.orangeLight : '#f8fafc',
                color: allInFileSelected ? HC.orangeDark : HC.muted,
                fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <div style={{
                width: 12, height: 12, borderRadius: 3,
                border: `1.5px solid ${allInFileSelected ? HC.orange : HC.muted2}`,
                background: allInFileSelected ? HC.orange : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {allInFileSelected && <span style={{ color: '#fff', fontSize: 8, fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              {allInFileSelected ? 'Bỏ chọn tất cả' : `Chọn tất cả (${fileRowIds.length})`}
              {selectedInFile > 0 && !allInFileSelected && (
                <span style={{ padding: '0 5px', borderRadius: 99, background: HC.orangeLight, color: HC.orangeDark, fontSize: 9.5, fontWeight: 800 }}>
                  {selectedInFile}/{fileRowIds.length}
                </span>
              )}
            </button>
          )}
          {!readOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              title="Xóa file này"
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid #fecaca', background: '#fef2f2',
                color: '#dc2626', fontSize: 10.5, fontWeight: 700,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >Xóa</button>
          )}
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{
              fontSize: 11, color: HC.orangeDark,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              display: 'inline-block',
            }}>▾</span>
          </div>
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
                padding: '11px 20px', border: 'none',
                borderBottom: activeSection === tab.id ? `2.5px solid ${HC.orange}` : '2.5px solid transparent',
                background: activeSection === tab.id ? HC.surface : 'transparent',
                color: activeSection === tab.id ? HC.orangeDark : HC.muted,
                fontSize: 12, fontWeight: activeSection === tab.id ? 900 : 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Nunito',sans-serif", transition: 'all 0.15s',
              }}>
                {tab.label}
                <span style={{
                  padding: '1px 8px', borderRadius: 99,
                  background: activeSection === tab.id ? HC.orangeLight : HC.border,
                  color: activeSection === tab.id ? HC.orangeDark : HC.muted,
                  fontSize: 10, fontWeight: 800,
                }}>
                  {tab.count ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Section Content */}
          <div style={{ background: HC.surface }}>
            {activeSection === 'general' && <GeneralInfoTable rows={entry.generalInfo} onSave={(newRows) => onUpdate({ ...entry, generalInfo: newRows })} readOnly={readOnly} selectable={selectable} selectedIds={selectedIds} onSelectRow={onSelectRow} onSelectAll={handleSelectAllInFile} bestSellerIds={bestSellerIds} toggleBestSeller={toggleBestSeller} mode={mode} />}
            {activeSection === 'pricing' && <PricingTable rows={entry.pricing} onSave={(newRows) => onUpdate({ ...entry, pricing: newRows })} readOnly={readOnly} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VendorLibraryViewer({ readOnly = false, mode = 'all', selectable = false, selectedIds, onSelectRow, onSelectAll, onLibraryLoaded, highlightFileId, onHighlightCleared }) {
  // rawFiles = dữ liệu gốc từ API (chưa filter theo product)
  const [rawFiles, setRawFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Filter theo product trong chế độ readOnly
  const [selectedProductId, setSelectedProductId] = useState('');
  const fileInputRef = useRef(null);
  const highlightRef = useRef(null);

  // Danh sách product có vendor được gán (dùng cho dropdown filter)
  const productOptions = useMemo(() => {
    if (!readOnly) return [];
    try {
      const LS_PRODUCT_VENDORS = 'STAFF_PRODUCT_VENDORS_V1';
      const assigned = JSON.parse(localStorage.getItem(LS_PRODUCT_VENDORS) || '{}');
      const products = JSON.parse(localStorage.getItem('MOCK_PRODUCTS') || '[]');
      return Object.keys(assigned)
        .filter(pid => (assigned[pid] || []).some(v => v.is_excel))
        .map(pid => {
          const p = products.find(pr => String(pr.id) === String(pid));
          return { id: pid, label: p?.product_type ? `${p.product_type} (#${pid})` : `Sản phẩm #${pid}` };
        });
    } catch { return []; }
  }, [readOnly, dataLoaded]);

  // libraryFiles = rawFiles đã filter theo product (chỉ trong readOnly + mode all)
  const libraryFiles = useMemo(() => {
    if (!readOnly || mode !== 'all') return rawFiles;
    try {
      const LS_PRODUCT_VENDORS = 'STAFF_PRODUCT_VENDORS_V1';
      const assigned = JSON.parse(localStorage.getItem(LS_PRODUCT_VENDORS) || '{}');
      const assignedIds = new Set();

      // Nếu chọn 1 product cụ thể, chỉ lấy vendor của product đó
      const sourceEntries = selectedProductId
        ? (assigned[selectedProductId] ? { [selectedProductId]: assigned[selectedProductId] } : {})
        : assigned;

      Object.values(sourceEntries).forEach(list => {
        (list || []).forEach(v => {
          if (v.is_excel) assignedIds.add(v.excel_row_id || v.id);
        });
      });

      if (assignedIds.size === 0) return [];

      return rawFiles.map(file => {
        if (!file.generalInfo) return file;
        const filteredGeneral = file.generalInfo.filter(r => assignedIds.has(r.id));
        if (filteredGeneral.length === 0) return null;
        const assignedKyHieus = new Set(filteredGeneral.map(r => r.kyHieu).filter(Boolean));
        const filteredPricing = (file.pricing || []).filter(p => assignedKyHieus.has(p.kyHieu));
        return { ...file, generalInfo: filteredGeneral, pricing: filteredPricing };
      }).filter(Boolean);
    } catch { return rawFiles; }
  }, [rawFiles, readOnly, mode, selectedProductId, dataLoaded]);

  useEffect(() => {
    if (highlightFileId && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, [highlightFileId, libraryFiles]);

  const [bestSellerIds, setBestSellerIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('BEST_SELLER_EXCEL_IDS_V1') || '[]'));
    } catch { return new Set(); }
  });

  const toggleBestSeller = useCallback((id) => {
    setBestSellerIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      localStorage.setItem('BEST_SELLER_EXCEL_IDS_V1', JSON.stringify([...n]));
      return n;
    });
  }, []);

  // File đã filter theo mode + search — dùng cho cả badge count lẫn list render
  const displayFiles = useMemo(() => {
    let files = libraryFiles;
    if (mode === 'bestseller' || mode === 'best_seller') {
      files = files.map(file => {
        if (!file.generalInfo) return file;
        return { ...file, generalInfo: file.generalInfo.filter(r => bestSellerIds.has(r.id)) };
      }).filter(file => file.generalInfo && file.generalInfo.length > 0);
    } else if (mode === 'new_products') {
      files = files.filter(file => file.sourceTab === 'new_products');
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      files = files.filter(file =>
        file.filename?.toLowerCase().includes(q) ||
        file.title?.toLowerCase().includes(q)
      );
    }
    return files;
  }, [libraryFiles, mode, bestSellerIds, searchQuery]);

  const fetchLibrary = useCallback(async () => {
    setFetchError(null);
    setDataLoaded(false);
    try {
      const res = await vendorLibraryApi.get(mode);
      const data = Array.isArray(res.data) ? res.data : [];

      // Lưu raw data — filter theo product được thực hiện trong useMemo (libraryFiles)
      setRawFiles(data);
      setDataLoaded(true);
      if (onLibraryLoaded) onLibraryLoaded(data);
    } catch (err) {
      console.error('Error fetching vendor library:', err);
      setFetchError(err?.response?.data?.message || err?.message || 'Không thể kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [mode, readOnly, onLibraryLoaded]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const saveLibrary = async (newData) => {
    if (!dataLoaded) {
      showToast('error', '❌ Dữ liệu chưa được tải xong, không thể lưu. Vui lòng thử lại.');
      return false;
    }
    try {
      await vendorLibraryApi.save(newData, mode);
      setRawFiles(newData);
      if (onLibraryLoaded) onLibraryLoaded(newData);
      return true;
    } catch (err) {
      console.error('Error saving vendor library:', err);
      showToast('error', `❌ Lỗi lưu dữ liệu: ${err?.response?.data?.message || err.message || 'Không thể kết nối server'}`);
      return false;
    }
  };

  const handleImport = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!files.length) return;

    if (!dataLoaded) {
      showToast('error', '❌ Dữ liệu thư viện chưa tải xong. Vui lòng đợi rồi thử lại.');
      return;
    }

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
          sourceTab: mode === 'new_products' ? 'new_products' : 'all',
        });
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (newEntries.length > 0) {
      const map = Object.fromEntries(libraryFiles.map(e => [e.filename, e]));
      newEntries.forEach(ne => { map[ne.filename] = ne; });
      const updated = Object.values(map);
      const saved = await saveLibrary(updated);
      if (saved) showToast('success', `✅ Import ${newEntries.length} file thành công${errors.length ? `, ${errors.length} lỗi` : ''}`);
    }

    if (errors.length > 0 && newEntries.length === 0) {
      showToast('error', `❌ Import thất bại`);
    }

    setImportErrors(errors);
    setImporting(false);
  }, [libraryFiles, dataLoaded]);

  const handleDelete = (id) => {
    setDeleteConfirm({ type: 'single', id });
  };

  const handleClearAll = () => {
    setDeleteConfirm({ type: 'all' });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'all') {
      const saved = await saveLibrary([]);
      if (saved) showToast('success', '🗑 Đã xóa toàn bộ thư viện');
    } else if (deleteConfirm.type === 'single') {
      const updated = libraryFiles.filter(e => e.id !== deleteConfirm.id);
      const saved = await saveLibrary(updated);
      if (saved) showToast('success', '🗑 Đã xóa file thư viện');
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

      <AppToast toast={toast} onClose={() => setToast(null)} />

      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
            {(mode === 'bestseller' || mode === 'best_seller') ? 'Danh sách Vendor Best Seller' : mode === 'new_products' ? 'Sản phẩm mới' : 'Tổng quan Vendor & Sản phẩm'}
          </div>
          <span style={{ padding: '2px 12px', borderRadius: 99, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>
            {displayFiles.length} file
          </span>
          {/* Product filter — chỉ hiện trong readOnly mode */}
          {readOnly && productOptions.length > 1 && (
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 20, border: `1.5px solid ${HC.borderStrong}`, fontSize: 12, background: HC.surface, color: selectedProductId ? HC.orangeDark : HC.muted, outline: 'none', cursor: 'pointer', fontWeight: selectedProductId ? 700 : 400 }}
            >
              <option value="">Tất cả sản phẩm</option>
              {productOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          )}
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tìm theo tên file hoặc loại sản phẩm..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 12, paddingRight: searchQuery ? 30 : 12, paddingTop: 7, paddingBottom: 7,
                borderRadius: 20, border: `1.5px solid ${HC.borderStrong}`,
                background: HC.surface, color: HC.ink, fontSize: 12,
                fontFamily: "'Nunito Sans',sans-serif", outline: 'none',
                width: 280, transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
              onFocus={e => { e.target.style.borderColor = HC.orangeDark; e.target.style.boxShadow = `0 0 0 3px ${HC.orangeGlow}`; }}
              onBlur={e => { e.target.style.borderColor = HC.borderStrong; e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: HC.muted, fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
            )}
          </div>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {rawFiles.length > 0 && (
              <button onClick={handleClearAll} style={{ padding: '9px 16px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#dc2626', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                Xóa tất cả
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: importing ? HC.muted2 : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 12, fontWeight: 800, cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {importing ? 'Đang import...' : 'Import thư viện Excel'}
            </button>
          </div>
        )}
      </div>

      {/* API fetch error banner */}
      {fetchError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#b91c1c', marginBottom: 3 }}>⚠️ Không thể tải dữ liệu thư viện</div>
            <div style={{ fontSize: 11, color: '#991b1b' }}>{fetchError}</div>
          </div>
          <button onClick={fetchLibrary} style={{ padding: '6px 14px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>↺ Thử lại</button>
        </div>
      )}

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(() => {
          if (loading) {
             return <div style={{ textAlign: 'center', padding: 40, color: HC.muted }}>Đang tải thư viện...</div>;
          }

          if (displayFiles.length === 0) {
            const isSearch = !!searchQuery.trim();
            return (
              <div style={{ padding: 40, textAlign: 'center', background: HC.surface, borderRadius: 16, border: `2px dashed ${HC.border}` }}>
                <div style={{ fontSize: 40, opacity: 0.5, marginBottom: 10 }}>{isSearch ? '🔍' : (mode === 'bestseller' || mode === 'best_seller') ? '⭐' : '📂'}</div>
                <div style={{ fontWeight: 800, color: HC.muted, fontSize: 14 }}>
                  {isSearch ? `Không tìm thấy file nào khớp với "${searchQuery}"` : (mode === 'bestseller' || mode === 'best_seller') ? 'Chưa có sản phẩm nào được đánh dấu Best Seller' : 'Chưa có thư viện vendor nào'}
                </div>
                {isSearch
                  ? <button onClick={() => setSearchQuery('')} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 20, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.muted, fontSize: 12, cursor: 'pointer' }}>Xóa tìm kiếm</button>
                  : (mode === 'bestseller' || mode === 'best_seller') && <div style={{ fontSize: 12, color: HC.muted2, marginTop: 6 }}>Hãy vào "Tổng quan Vendor & Sản phẩm" và click biểu tượng ⭐ trên sản phẩm để đánh dấu.</div>
                }
              </div>
            );
          }

          return displayFiles.map((entry, idx) => (
            <div key={entry.id} ref={highlightFileId === entry.id ? highlightRef : null}>
              <LibraryCard
                entry={entry}
                idx={idx}
                onDelete={handleDelete}
                onUpdate={handleUpdateEntry}
                readOnly={readOnly}
                selectable={selectable}
                selectedIds={selectedIds}
                onSelectRow={onSelectRow}
                onSelectAll={onSelectAll}
                bestSellerIds={bestSellerIds}
                toggleBestSeller={toggleBestSeller}
                mode={mode}
                highlighted={highlightFileId === entry.id}
              />
            </div>
          ));
        })()}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 400, boxShadow: HC.shadowStrong, animation: 'scaleIn 0.2s ease-out' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#dc2626', fontFamily: "'Nunito',sans-serif" }}>Xác nhận xóa</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: HC.muted, lineHeight: 1.5 }}>
              {deleteConfirm.type === 'all' 
                ? `Bạn có chắc chắn muốn xóa toàn bộ ${rawFiles.length} file thư viện? Hành động này không thể hoàn tác.`
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
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
