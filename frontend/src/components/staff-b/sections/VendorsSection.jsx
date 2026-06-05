import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { vendorApi } from '../../../services/api';
import { HC, LS_PRODUCT_VENDORS, VENDOR_TYPES, VENDOR_PAGE_SIZE } from '../utils/constants';
import { lsGet, lsSet, parseVendorExcel, buildVendorPayload, VENDOR_TYPE_LIST, normalizeVendorType } from '../utils/helpers';
import { Spinner, EmptyState, BestSellerBadge } from '../ui/StaffBUI';

export default function VendorsSection({ filterProductType = '', filterProductId = '', onClearFilter, onAssignComplete }) {
  const [activeTab, setActiveTab] = useState('all'); 
  const EMPTY_VENDOR = {
    name: '', vendor_type: '', product_type: '', size: '', optional: '', pricing: '',
    eco_price: '', eco_total: '', fast_price: '', fast_total: '',
    express_price: '', express_total: '', overnight_price: '', overnight_total: ''
  };

  const [vendorList, setVendorList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [vForm, setVForm] = useState(EMPTY_VENDOR);
  const [editingVId, setEditingVId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [vPage, setVPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const importFileRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreviewPage, setImportPreviewPage] = useState(1);
  const [importResult, setImportResult] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const vf = key => e => setVForm(p => ({ ...p, [key]: e.target.value }));
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorModalMode, setVendorModalMode] = useState('create');

  const loadVendors = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setApiError('');
    try {
      const res = await vendorApi.list({ per_page: 10000 });
      let list = [];
      if (res.data?.data?.data && Array.isArray(res.data.data.data)) {
        list = res.data.data.data;
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      }
      setVendorList(list);
      localStorage.setItem('STAFF_VENDOR_LIST_V1', JSON.stringify(list));
    } catch (err) {
      setApiError(err.response?.data?.message || err.message || 'Lỗi tải vendor');
      setVendorList([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);
  useEffect(() => { setVPage(1); setSelectedIds(new Set()); setSearchFilter(''); }, [filterProductType, filterProductId, activeTab]);
  useEffect(() => { setVForm(EMPTY_VENDOR); }, []);

  let filteredVendors = activeTab === 'bestseller' ? vendorList.filter(v => v.vendor_type === 'Best Seller') : vendorList;

  if (filterProductType) {
    filteredVendors = filteredVendors.filter(v => (v.product_type || '').toLowerCase().includes(filterProductType.toLowerCase()));
  }
  if (searchFilter && !filterProductType) {
    filteredVendors = filteredVendors.filter(v => (v.product_type || '').toLowerCase().includes(searchFilter.toLowerCase()));
  }

  const totalVPages = Math.ceil(filteredVendors.length / VENDOR_PAGE_SIZE);
  const pagedVendors = filteredVendors.slice((vPage - 1) * VENDOR_PAGE_SIZE, vPage * VENDOR_PAGE_SIZE);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    const pageIds = pagedVendors.map(v => v.id);
    const allSel = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => { const n = new Set(prev); if (allSel) { pageIds.forEach(id => n.delete(id)); } else { pageIds.forEach(id => n.add(id)); } return n; });
  };
  const pageAllSelected = pagedVendors.length > 0 && pagedVendors.every(v => selectedIds.has(v.id));
  const pageSomeSelected = pagedVendors.some(v => selectedIds.has(v.id));
  
  const selectedVendorsList = vendorList.filter(v => selectedIds.has(v.id));
  const uniqueSelectedCount = new Set(selectedVendorsList.map(v => ((v.name || v.vendor_type || '—') || '').toString().trim())).size;


  const handleAssignVendor = () => {
    if (selectedIds.size === 0) { alert('Vui lòng chọn ít nhất 1 vendor!'); return; }
    const selected = vendorList.filter(v => selectedIds.has(v.id));
    const productId = filterProductId;
    if (!productId) { alert('Không xác định được sản phẩm.'); return; }
    const all = lsGet(LS_PRODUCT_VENDORS, {}); all[productId] = selected; lsSet(LS_PRODUCT_VENDORS, all);
    window.dispatchEvent(new StorageEvent('storage', { key: LS_PRODUCT_VENDORS }));
    alert(`✅ Đã gán ${uniqueSelectedCount} vendor cho sản phẩm!`);
    setSelectedIds(new Set()); onAssignComplete();
  };

  const getDetailedError = (err) => {
    if (err.response?.data?.errors) {
      const e = err.response.data.errors;
      return typeof e === 'object' ? Object.entries(e).map(([f, m]) => `${f}: ${Array.isArray(m) ? m.join(', ') : m}`).join('; ') : e;
    }
    return err.response?.data?.message || err.message || 'Lỗi không xác định';
  };

  const handleExportSample = () => {
    const columns = [
      'Vendor Name', 'Product Type', 'Vendor Type', 'Size', 'Optional',
      'Pricing 1', 'Pricing 2', 'Economy Price Ship', 'Economy Total',
      'Fast Price Ship', 'Fast Total', 'Express Price Ship', 'Express Total',
      'Overnight Price Ship', 'Overnight Total'
    ];

    let exportData = [];
    if (filteredVendors.length > 0) {
      exportData = filteredVendors.map(v => ({
        'Vendor Name': v.name || v.vendor_name || '',
        'Product Type': v.product_type || '',
        'Vendor Type': v.vendor_type || '',
        'Size': v.size || '',
        'Optional': v.optional || '',
        'Pricing 1': v.pricing1 != null ? Number(v.pricing1).toFixed(2) : '',
        'Pricing 2': v.pricing2 != null ? Number(v.pricing2).toFixed(2) : '',
        'Economy Price Ship': v.eco_price != null ? Number(v.eco_price).toFixed(2) : '',
        'Economy Total': v.eco_total != null ? Number(v.eco_total).toFixed(2) : '',
        'Fast Price Ship': v.fast_price != null ? Number(v.fast_price).toFixed(2) : '',
        'Fast Total': v.fast_total != null ? Number(v.fast_total).toFixed(2) : '',
        'Express Price Ship': v.express_price != null ? Number(v.express_price).toFixed(2) : '',
        'Express Total': v.express_total != null ? Number(v.express_total).toFixed(2) : '',
        'Overnight Price Ship': v.overnight_price != null ? Number(v.overnight_price).toFixed(2) : '',
        'Overnight Total': v.overnight_total != null ? Number(v.overnight_total).toFixed(2) : '',
      }));
    } else {
      const emptyRow = {}; columns.forEach(col => { emptyRow[col] = ''; }); exportData = [emptyRow];
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
    ];
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Arial' },
      fill: { fgColor: { rgb: activeTab === 'bestseller' ? 'D4A017' : 'F59E0B' }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: 'CCCCCC' } }, bottom: { style: 'thin', color: { rgb: 'CCCCCC' } }, left: { style: 'thin', color: { rgb: 'CCCCCC' } }, right: { style: 'thin', color: { rgb: 'CCCCCC' } } }
    };
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:O1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[address]) continue;
      ws[address].s = headerStyle;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'bestseller' ? 'Best_Seller' : 'Vendors');
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = filteredVendors.length > 0 ? `Vendors_${activeTab === 'bestseller' ? 'BestSeller_' : 'All_'}_${ts}.xlsx` : `Vendor_Template_${ts}.xlsx`;
    XLSX.writeFile(wb, filename);

    if (filteredVendors.length === 0) alert('📋 Đã tải file Excel mẫu! Hãy điền dữ liệu và Import lại.');
    else alert(`✅ Đã xuất ${filteredVendors.length} vendor ra file Excel!`);
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setImporting(true);
    setImportResult(null);
    const errors = [];
    const vendors = [];

    for (let i = 0; i < importPreview.length; i++) {
      const cleanedData = buildVendorPayload(importPreview[i]);

      if (!cleanedData.product_type) {
        errors.push({ idx: i + 1, name: `dòng ${i + 1}`, message: 'Thiếu Product Type' });
        continue;
      }
      if (!cleanedData.vendor_type || !VENDOR_TYPE_LIST.includes(cleanedData.vendor_type)) {
        errors.push({
          idx: i + 1,
          name: cleanedData.product_type,
          message: `Vendor Type không hợp lệ (cần: Old, New, Best Seller hoặc Loại 1/2/3)`,
        });
        continue;
      }

      vendors.push(cleanedData);
    }

    if (vendors.length === 0) {
      setImporting(false);
      setImportResult({
        success: false,
        summary: { total: importPreview.length, created: 0, updated: 0, failed: errors.length },
        errors,
      });
      return;
    }

    try {
      const res = await vendorApi.importBulk(vendors);
      const summary = res?.data?.summary || {};
      const apiErrors = res?.data?.errors || [];

      await loadVendors();

      const created = summary.created ?? 0;
      const updated = summary.updated ?? 0;
      const failed = summary.failed ?? 0;
      const mergedErrors = [
        ...errors,
        ...apiErrors.map((e) => ({ idx: e.row, message: e.message })),
      ];

      setImportResult({
        success: failed === 0 && mergedErrors.length === 0,
        summary: {
          total: summary.total ?? vendors.length,
          created,
          updated,
          failed: failed + errors.length,
        },
        errors: mergedErrors,
      });
    } catch (err) {
      setImportResult({
        success: false,
        summary: { total: vendors.length, created: 0, updated: 0, failed: vendors.length },
        errors: [{ idx: '-', message: `Lỗi import (API): ${getDetailedError(err)}` }],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (importFileRef.current) importFileRef.current.value = '';
    if (!file) return;
    setImportResult(null);
    if (!['xlsx', 'xls', 'csv'].includes(file.name.split('.').pop().toLowerCase())) { alert('Vui lòng chọn file Excel!'); return; }
    try {
      const parsed = await parseVendorExcel(file);
      if (parsed.length === 0) { alert('File không có dữ liệu!'); return; }
      setImportPreview(parsed); setImportPreviewPage(1); setImportConfirmOpen(true);
    } catch (err) { alert('Lỗi đọc file: ' + err.message); }
  };

  const handleVSubmit = async () => {
    if (!vForm.product_type.trim()) { alert('Vui lòng nhập Product Type!'); return; }
    if (!vForm.vendor_type.trim()) { alert('Vui lòng chọn Vendor Type!'); return; }
    setSubmitting(true);
    try {
      const totalPricing = parseFloat(vForm.pricing) || 0;
      const pricing1 = totalPricing / 2;
      const pricing2 = totalPricing / 2;
      const dataToSend = {
        product_type: vForm.product_type, vendor_type: normalizeVendorType(vForm.vendor_type), name: vForm.name || '',
        size: vForm.size || '', optional: vForm.optional || '', pricing1, pricing2,
        eco_price: vForm.eco_price ? parseFloat(vForm.eco_price) : null, eco_total: vForm.eco_total ? parseFloat(vForm.eco_total) : null,
        fast_price: vForm.fast_price ? parseFloat(vForm.fast_price) : null, fast_total: vForm.fast_total ? parseFloat(vForm.fast_total) : null,
        express_price: vForm.express_price ? parseFloat(vForm.express_price) : null, express_total: vForm.express_total ? parseFloat(vForm.express_total) : null,
        overnight_price: vForm.overnight_price ? parseFloat(vForm.overnight_price) : null, overnight_total: vForm.overnight_total ? parseFloat(vForm.overnight_total) : null,
      };
      if (editingVId !== null) { await vendorApi.update(editingVId, dataToSend); alert('✅ Cập nhật vendor thành công!'); }
      else { await vendorApi.create(dataToSend); alert('✅ Tạo vendor thành công!'); }
      await loadVendors(); closeVendorModal();
    } catch (err) { alert('Lỗi: ' + getDetailedError(err)); } finally { setSubmitting(false); }
  };

  const handleVEdit = vendor => openEditVendorModal(vendor);
  const handleVDelete = async (vendor) => { setVendorToDelete(vendor); setDeleteModalOpen(true); };
  
  const openCreateVendorModal = () => { setVForm(EMPTY_VENDOR); setEditingVId(null); setVendorModalMode('create'); setVendorModalOpen(true); };
  const openEditVendorModal = (vendor) => {
    const totalPricing = (vendor.pricing1 || 0) + (vendor.pricing2 || 0);
    setVForm({
      name: vendor.name || '', product_type: vendor.product_type || '', vendor_type: vendor.vendor_type || '',
      size: vendor.size || '', optional: vendor.optional || '', pricing: totalPricing,
      eco_price: vendor.eco_price ?? '', eco_total: vendor.eco_total ?? '', fast_price: vendor.fast_price ?? '', fast_total: vendor.fast_total ?? '',
      express_price: vendor.express_price ?? '', express_total: vendor.express_total ?? '', overnight_price: vendor.overnight_price ?? '', overnight_total: vendor.overnight_total ?? ''
    });
    setEditingVId(vendor.id); setVendorModalMode('edit'); setVendorModalOpen(true);
  };
  const closeVendorModal = () => { setVendorModalOpen(false); setVForm(EMPTY_VENDOR); setEditingVId(null); setVendorModalMode('create'); };
  
  const confirmDelete = async () => {
    if (!vendorToDelete) return;
    const deletedId = vendorToDelete.id; const deletedType = vendorToDelete.vendor_type;
    setDeleteModalOpen(false); setVendorToDelete(null);
    try {
      await vendorApi.delete(deletedId);
      const verifyRes = await vendorApi.list({ per_page: 10000 });
      const verifyList = Array.isArray(verifyRes.data?.data?.data) ? verifyRes.data.data.data : Array.isArray(verifyRes.data?.data) ? verifyRes.data.data : Array.isArray(verifyRes.data) ? verifyRes.data : [];
      const stillExists = verifyList.some(v => v.id === deletedId);
      if (stillExists) { setVendorList(verifyList); alert('⚠️ Lỗi: Server báo xóa thành công nhưng dữ liệu vẫn còn trong DB. Kiểm tra lại API.'); return; }
      setVendorList(verifyList); setVPage(1);
      setToast({ type: 'success', title: '✅ Xóa thành công!', message: `Đã xóa vendor "${deletedType}"`, duration: 3000 });
    } catch (err) { await loadVendors(true); alert(`Lỗi xóa [${err.response?.status}]: ${getDetailedError(err)}`); }
  };

  const inp3 = { padding: '7px 9px', borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, color: HC.ink2, background: HC.surface2, width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: "'Nunito Sans',sans-serif", transition: 'border-color 0.2s' };
  const TH2 = (extra = {}) => ({ padding: '8px 10px', fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: extra.textAlign || 'center', color: '#fff', background: activeTab === 'bestseller' ? HC.gold : HC.orangeDark, border: `1px solid ${activeTab === 'bestseller' ? '#C8A000' : HC.orange}`, fontFamily: "'Nunito',sans-serif", verticalAlign: 'middle', ...extra });
  const TD = (extra = {}) => ({ padding: '9px 10px', fontSize: 12, color: HC.ink2, border: `1px solid ${HC.border}`, textAlign: extra.textAlign || 'center', verticalAlign: 'middle', background: HC.surface2, fontFamily: "'Nunito Sans',sans-serif", ...extra });
  const TDalt = (extra = {}) => ({ ...TD(extra), background: activeTab === 'bestseller' ? HC.goldLight : HC.orangePale });
  const fmt = n => (n != null && n !== '') ? Number(n).toFixed(2) : '—';

  const PREV_PAGE_SIZE = 50;
  const totalPrevPages = importPreview ? Math.ceil(importPreview.length / PREV_PAGE_SIZE) : 1;
  const pagedPreview = importPreview ? importPreview.slice((importPreviewPage - 1) * PREV_PAGE_SIZE, importPreviewPage * PREV_PAGE_SIZE) : [];
  const PREVIEW_COLS = ['Vendor Name', 'Product Type', 'Vendor Type', 'Size', 'Pricing 1', 'Eco Total', 'Fast Total'];
  const getCell = (v, col) => {
    const map = {
      'Vendor Name': v.name || v.vendor_name || v['Vendor Name'] || '', 'Product Type': v.product_type || v['Product Type'] || '',
      'Vendor Type': v.vendor_type || v['Vendor Type'] || '', 'Size': v.size || v.Size || '',
      'Pricing 1': v.pricing1 || v['Pricing 1'] ? `$${Number(v.pricing1 || v['Pricing 1']).toFixed(2)}` : '',
      'Eco Total': v.eco_total || v['Eco Total'] ? `$${Number(v.eco_total || v['Eco Total']).toFixed(2)}` : '',
      'Fast Total': v.fast_total || v['Fast Total'] ? `$${Number(v.fast_total || v['Fast Total']).toFixed(2)}` : ''
    };
    return map[col] || '—';
  };

  const MiniPager = ({ page, total, onChange, label }) => {
    if (total <= 1) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: HC.surface, borderTop: `1.5px solid ${HC.border}` }}>
        <span style={{ fontSize: 11, color: HC.muted, fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => onChange(page - 1)} disabled={page === 1} style={{ minWidth: 28, height: 28, borderRadius: 7, border: `1.5px solid ${HC.border}`, background: HC.cream, color: HC.muted2, fontSize: 12, fontWeight: 700, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>‹</button>
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => onChange(p)} style={{ minWidth: 28, height: 28, borderRadius: 7, border: `1.5px solid ${p === page ? HC.orange : HC.border}`, background: p === page ? HC.orange : HC.surface, color: p === page ? '#fff' : HC.ink2, fontSize: 12, fontWeight: p === page ? 900 : 700, cursor: 'pointer' }}>{p}</button>
          ))}
          <button onClick={() => onChange(page + 1)} disabled={page === total} style={{ minWidth: 28, height: 28, borderRadius: 7, border: `1.5px solid ${HC.border}`, background: HC.cream, color: HC.muted2, fontSize: 12, fontWeight: 700, cursor: page === total ? 'not-allowed' : 'pointer', opacity: page === total ? 0.4 : 1 }}>›</button>
        </div>
      </div>
    );
  };

  const ImportConfirmModal = () => {
    if (!importConfirmOpen || !importPreview) return null;
    const hasImportResult = Boolean(importResult);
    const resultErrors = importResult?.errors || [];

    const uniqueVendorNames = new Set(
      importPreview
        .map(v => (v.name || v.vendor_name || v['Vendor Name'] || '').toString().trim())
        .filter(Boolean)
    );
    const uniqueCount = uniqueVendorNames.size > 0 ? uniqueVendorNames.size : importPreview.length;

    return (
      <div onClick={() => { if (!importing) { setImportConfirmOpen(false); setImportPreview(null); setImportResult(null); } }} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, backdropFilter: 'blur(3px)', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 800, background: HC.surface, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
          <div style={{ padding: '18px 22px', background: HC.ink, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,166,35,0.15)', border: '1.5px solid rgba(245,166,35,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📥</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Xác nhận Import Vendor</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Tìm thấy <b style={{ color: HC.orange }}>{uniqueCount} vendor</b> ({importPreview.length} phân loại)</div>
            </div>
            {!importing && <button onClick={() => { setImportConfirmOpen(false); setImportPreview(null); setImportResult(null); }} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)' }}>✕</button>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '16px 22px 0' }}>
            {hasImportResult && (
              <div style={{ marginBottom: 12, borderRadius: 12, border: `1.5px solid ${importResult.success ? '#bbf7d0' : '#fecaca'}`, background: importResult.success ? '#ecfdf5' : '#fef2f2', padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: importResult.success ? '#166534' : '#b91c1c' }}>
                  {importResult.success ? '✅ Import thành công' : '⚠️ Import hoàn tất có lỗi'}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: HC.ink2 }}>
                  Tổng: <b>{importResult.summary.total}</b> · Thêm mới: <b>{importResult.summary.created}</b> · Cập nhật: <b>{importResult.summary.updated}</b> · Lỗi: <b>{importResult.summary.failed}</b>
                </div>
                {resultErrors.length > 0 && (
                  <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto', background: '#fff', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 8px' }}>
                    {resultErrors.slice(0, 20).map((e, idx) => (
                      <div key={idx} style={{ fontSize: 11, color: '#991b1b', lineHeight: 1.5 }}>
                        Dòng {e.idx ?? '-'}: {e.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
              <thead><tr>
                <th style={{ ...TH2({ minWidth: 36 }), padding: '7px 8px' }}>#</th>{PREVIEW_COLS.map(c => <th key={c} style={TH2({ minWidth: 90 })}>{c}</th>)}</tr></thead>
              <tbody>
                {pagedPreview.map((v, i) => {
                  const absIdx = (importPreviewPage - 1) * PREV_PAGE_SIZE + i;
                  const C = absIdx % 2 === 0 ? TD : TDalt;
                  return (
                    <tr key={absIdx}>
                      <td style={{ ...C(), color: HC.muted, fontWeight: 700 }}>{absIdx + 1}</td>
                      {PREVIEW_COLS.map(col => <td key={col} style={{ ...C(), fontWeight: col === 'Product Type' || col === 'Vendor Type' ? 700 : 400, color: col === 'Product Type' ? HC.orangeDark : col.includes('Total') ? HC.success : HC.ink2 }}>{getCell(v, col) || <span style={{ color: HC.muted2, fontStyle: 'italic' }}>—</span>}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPrevPages > 1 && <div style={{ padding: '4px 22px', flexShrink: 0 }}><MiniPager page={importPreviewPage} total={totalPrevPages} onChange={setImportPreviewPage} label={`Xem ${(importPreviewPage - 1) * PREV_PAGE_SIZE + 1}–${Math.min(importPreview.length, importPreviewPage * PREV_PAGE_SIZE)} / ${importPreview.length}`} /></div>}
          <div style={{ padding: '14px 22px', background: HC.cream, borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ flex: 1, fontSize: 11, color: HC.muted }}>{importing ? '⟳ Đang import...' : hasImportResult ? 'Đã có kết quả import' : `Sẽ thêm ${uniqueCount} vendor (${importPreview.length} phân loại)`}</div>
            <button onClick={() => { setImportConfirmOpen(false); setImportPreview(null); setImportResult(null); }} disabled={importing} style={{ padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${HC.border}`, background: HC.surface, color: HC.brown, fontSize: 12, fontWeight: 700, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.5 : 1 }}>{hasImportResult ? 'Đóng' : 'Hủy'}</button>
            <button onClick={handleConfirmImport} disabled={importing} style={{ padding: '9px 26px', borderRadius: 10, border: 'none', background: importing ? HC.muted2 : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', fontSize: 12, fontWeight: 900, cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>{importing ? '⟳ Đang import...' : hasImportResult ? 'Import lại' : `✓ Import ${uniqueCount} Vendor`}</button>
          </div>
        </div>
      </div>
    );
  };

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '10px 24px', borderRadius: 12, border: `2px solid ${activeTab === id ? (id === 'bestseller' ? HC.gold : HC.orange) : HC.border}`,
        background: activeTab === id ? (id === 'bestseller' ? HC.goldLight : HC.orangeLight) : HC.surface,
        color: activeTab === id ? (id === 'bestseller' ? HC.gold : HC.orangeDark) : HC.muted,
        fontSize: 13, fontWeight: activeTab === id ? 900 : 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
      }}
      onMouseEnter={e => { if (activeTab !== id) e.currentTarget.style.background = HC.orangePale; }}
      onMouseLeave={e => { if (activeTab !== id) e.currentTarget.style.background = HC.surface; }}
    >
      {icon && <span>{icon}</span>}
      {label}
      {id === 'bestseller' && <BestSellerBadge />}
    </button>
  );

  return (
    <div>
      <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportFile} />
      {apiError && <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>⚠️ {apiError}</span><button onClick={loadVendors} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button></div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: `1.5px solid ${HC.border}`, paddingBottom: 8 }}>
        <TabButton id="all" label="Tất cả Vendor" icon="🏪" />
        <TabButton id="bestseller" label="Best Seller" icon="⭐" />
      </div>

      {filterProductType && (
        <div style={{ marginBottom: 14, padding: '12px 18px', borderRadius: 12, background: `linear-gradient(135deg,${HC.orangeLight},${HC.orangeMid})`, border: `1.5px solid ${HC.orange}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: HC.ink }}>Đang tìm vendor cho: <span style={{ color: HC.orangeDark }}>"{filterProductType}"</span></div>
            <div style={{ fontSize: 11, color: HC.brown, marginTop: 2 }}>Tích chọn vendor phù hợp rồi nhấn <b>Gán Vendor</b></div>
          </div>
          <button onClick={onClearFilter} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${HC.orangeDark}`, background: 'rgba(255,255,255,0.6)', color: HC.brown, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕ Bỏ lọc</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: activeTab === 'bestseller' ? HC.gold : HC.ink, fontFamily: "'Nunito',sans-serif" }}>
            {activeTab === 'bestseller' ? '⭐ Best Seller' : 'Tất Cả Vendor'}
            <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, background: activeTab === 'bestseller' ? HC.goldLight : HC.orangeLight, border: `1.5px solid ${activeTab === 'bestseller' ? '#D4A017' : HC.orangeMid}`, color: activeTab === 'bestseller' ? HC.gold : HC.orangeDark, fontSize: 11, fontWeight: 800 }}>
              {new Set(filteredVendors.map(v => ((v.name || v.vendor_type || '—') || '').toString().trim())).size}
              {!filterProductType && vendorList.length !== filteredVendors.length ? ` / ${new Set(vendorList.map(v => ((v.name || v.vendor_type || '—') || '').toString().trim())).size}` : ''}
            </span>
          </div>

          {!filterProductType && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: HC.muted, fontSize: 12, pointerEvents: 'none' }}>🔍</span>
              <input type="text" placeholder="Lọc product type..." value={searchFilter} onChange={e => { setSearchFilter(e.target.value); setVPage(1); }} style={{ ...inp3, width: 170, paddingLeft: 28 }} onFocus={e => e.target.style.borderColor = HC.orange} onBlur={e => e.target.style.borderColor = HC.border} />
            </div>
          )}
          {searchFilter && !filterProductType && <button onClick={() => { setSearchFilter(''); setVPage(1); }} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕</button>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedIds.size > 0 && filterProductId && (
            <button onClick={handleAssignVendor} style={{ padding: '9px 20px', borderRadius: 10, background: `linear-gradient(135deg,${HC.success},#15803d)`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              <span>✅</span> Gán {uniqueSelectedCount} Vendor
            </button>
          )}
          <button onClick={loadVendors} style={{ padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${HC.border}`, background: HC.cream, color: HC.brown, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>↻ Làm mới</button>
          <button onClick={openCreateVendorModal} style={{ padding: '9px 16px', borderRadius: 10, background: HC.cream, border: `1.5px solid ${HC.border}`, color: HC.brown, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            {activeTab === 'bestseller' ? '⭐ Tạo Best Seller' : '＋ Thêm thủ công'}
          </button>
          <button onClick={() => importFileRef.current?.click()} style={{ padding: '9px 20px', borderRadius: 10, background: activeTab === 'bestseller' ? `linear-gradient(135deg,#FFD700,#FFA500)` : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: activeTab === 'bestseller' ? '#7A5C00' : '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span>📥</span> Import
          </button>
          <button onClick={handleExportSample} style={{ padding: '9px 20px', borderRadius: 10, background: `linear-gradient(135deg,${HC.brown},${HC.brownLight})`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
            <span>📤</span> Export
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 12, background: '#ecfdf5', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: HC.success }}>✓ Đã chọn {uniqueSelectedCount} vendor</span>
          <button onClick={() => setSelectedIds(new Set())} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${HC.success}`, background: 'transparent', color: HC.success, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Bỏ chọn tất cả</button>
          {!filterProductId && <span style={{ fontSize: 11, color: '#92400e' }}>⚠️ Để gán vendor, vào Products → nhấn "Tìm Vendor".</span>}
        </div>
      )}

      {loading ? <Spinner /> : filteredVendors.length === 0 && !vendorModalOpen ? (
        <EmptyState msg={activeTab === 'bestseller' ? <span>Chưa có Best Seller vendor nào. Nhấn <b style={{ color: HC.gold }}>⭐ Tạo Best Seller</b> để bắt đầu.</span> : <span>Chưa có vendor. Nhấn <b style={{ color: HC.orange }}>📥 Import</b> để bắt đầu.</span>} />
      ) : filteredVendors.length > 0 && (
        <div style={{ borderRadius: 16, border: `1.5px solid ${activeTab === 'bestseller' ? '#D4A017' : HC.border}`, boxShadow: activeTab === 'bestseller' ? '0 8px 32px rgba(212,160,23,0.15)' : HC.shadow, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...TH2({ minWidth: 44, width: 44 }), cursor: 'pointer', textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px' }} onClick={toggleAll}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${pageAllSelected ? '#fff' : 'rgba(255,255,255,0.5)'}`, background: pageAllSelected ? '#fff' : pageSomeSelected ? 'rgba(255,255,255,0.4)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                        {pageAllSelected && <span style={{ color: activeTab === 'bestseller' ? HC.gold : HC.orangeDark, fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        {!pageAllSelected && pageSomeSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>–</span>}
                      </div>
                    </div>
                  </th>
                  <th rowSpan={2} style={{ ...TH2(), minWidth: 36 }}>ID</th>
                  <th rowSpan={2} style={{ ...TH2(), minWidth: 130 }}>Vendor Name</th>
                  <th rowSpan={2} style={TH2({ minWidth: 110 })}>Vendor Type</th>
                  <th rowSpan={2} style={{ ...TH2(), minWidth: 120 }}>Product Type</th>
                  <th rowSpan={2} style={{ ...TH2({ minWidth: 90, background: activeTab === 'bestseller' ? '#C8A000' : HC.orange }), color: '#fff' }}>💰 Pricing</th>
                  <th colSpan={2} style={TH2()}>Detail</th>
                  <th colSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? '#C8A000' : HC.orange }}>Economy</th>
                  <th colSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? HC.gold : HC.orangeDark }}>Fast</th>
                  <th colSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? '#C8A000' : HC.orange }}>Express</th>
                  <th colSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? HC.gold : HC.orangeDark }}>Overnight</th>
                  <th rowSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? '#8B6914' : HC.orangeDeep, minWidth: 90 }}>Thao tác</th>
                </tr>
                <tr>
                  <th style={TH2({ minWidth: 80 })}>Size</th>
                  <th style={TH2({ minWidth: 90 })}>Optional</th>
                  {['Economy', 'Fast', 'Express', 'Overnight'].map(s => [
                    <th key={`${s}-p`} style={TH2({ minWidth: 85, background: (s === 'Fast' || s === 'Overnight') ? (activeTab === 'bestseller' ? HC.gold : HC.orangeDark) : (activeTab === 'bestseller' ? '#C8A000' : HC.orange) })}>Price Ship</th>,
                    <th key={`${s}-t`} style={TH2({ minWidth: 100, background: (s === 'Fast' || s === 'Overnight') ? (activeTab === 'bestseller' ? HC.gold : HC.orangeDark) : (activeTab === 'bestseller' ? '#C8A000' : HC.orange) })}>Total</th>,
                  ]).flat()}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const groupIndices = [];
                  let currentGrp = 1;
                  for (let k = 0; k < filteredVendors.length; k++) {
                    const vName = ((filteredVendors[k].name || filteredVendors[k].vendor_type || '—') || '').toString().trim();
                    if (k > 0) {
                      const pName = ((filteredVendors[k-1].name || filteredVendors[k-1].vendor_type || '—') || '').toString().trim();
                      if (vName !== pName) currentGrp++;
                    }
                    groupIndices.push(currentGrp);
                  }

                  const rows = [];
                  for (let i = 0; i < pagedVendors.length; i++) {
                    const v = pagedVendors[i];
                    const absIdx = (vPage - 1) * VENDOR_PAGE_SIZE + i;
                    const vendorGroupIndex = groupIndices[absIdx];
                    const C = absIdx % 2 === 0 ? TD : TDalt;
                    const isSelected = selectedIds.has(v.id);
                    const totalPricing = (v.pricing1 || 0) + (v.pricing2 || 0);
                    const vendorName = ((v.name || v.vendor_type || '—') || '').toString().trim();
                    const prevVendorName = i > 0 ? (((pagedVendors[i - 1].name || pagedVendors[i - 1].vendor_type || '—') || '').toString().trim()) : null;
                    const isSameAsPrev = i > 0 && vendorName === prevVendorName;

                    let rowSpan = 1;
                    if (!isSameAsPrev && vendorName) {
                      for (let j = i + 1; j < pagedVendors.length; j++) {
                        const nextName = (((pagedVendors[j].name || pagedVendors[j].vendor_type || '—') || '').toString().trim());
                        if (nextName !== vendorName) break;
                        rowSpan++;
                      }
                    }

                    rows.push(
                      <tr key={v.id || absIdx} style={{ background: isSelected ? (activeTab === 'bestseller' ? '#FFFDE7' : `${HC.orange}12`) : undefined }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.97)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                        {!isSameAsPrev && (
                          <td rowSpan={rowSpan} style={{ ...C(), cursor: 'pointer', width: 44, textAlign: 'center', verticalAlign: 'middle', padding: '8px 4px' }} onClick={() => {
                            const groupIds = [];
                            for (let j = i; j < i + rowSpan; j++) {
                              if (pagedVendors[j] && pagedVendors[j].id) groupIds.push(pagedVendors[j].id);
                            }
                            const allSelected = groupIds.length > 0 && groupIds.every(gid => selectedIds.has(gid));
                            setSelectedIds(prev => {
                              const n = new Set(prev);
                              if (allSelected) {
                                groupIds.forEach(gid => n.delete(gid));
                              } else {
                                groupIds.forEach(gid => n.add(gid));
                              }
                              return n;
                            });
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isSelected ? (activeTab === 'bestseller' ? HC.gold : HC.orange) : HC.muted2}`, background: isSelected ? (activeTab === 'bestseller' ? HC.gold : HC.orange) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                                {isSelected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                              </div>
                            </div>
                          </td>
                        )}
                        {!isSameAsPrev && (
                          <td rowSpan={rowSpan} style={{ ...C(), color: HC.muted, fontWeight: 700, verticalAlign: 'middle' }}>{vendorGroupIndex}</td>
                        )}
                        {!isSameAsPrev && (
                          <td rowSpan={rowSpan} style={{ ...C(), fontWeight: 800, color: HC.ink2, verticalAlign: 'middle' }}>{vendorName}</td>
                        )}
                        <td style={{ ...C(), fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {v.vendor_type === 'Best Seller' ? <BestSellerBadge /> : (v.vendor_type || '—')}
                        </td>
                        <td style={{ ...C(), fontWeight: 800, color: activeTab === 'bestseller' ? HC.gold : HC.orange }}>{v.product_type || '—'}</td>
                        <td style={{ ...C(), fontWeight: 800, color: HC.success, fontSize: 13 }}>${totalPricing.toFixed(2)}</td>
                        <td style={C()}>{v.size || '—'}</td>
                        <td style={C()}>{v.optional || '—'}</td>
                        <td style={{ ...C(), borderLeft: `2px solid ${HC.border}` }}>{fmt(v.eco_price)}</td>
                        <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.eco_total)}</td>
                        <td style={C()}>{fmt(v.fast_price)}</td>
                        <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.fast_total)}</td>
                        <td style={C()}>{fmt(v.express_price)}</td>
                        <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.express_total)}</td>
                        <td style={C()}>{fmt(v.overnight_price)}</td>
                        <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.overnight_total)}</td>
                        <td style={C()}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                            <button onClick={() => openEditVendorModal(v)} style={{ padding: '4px 10px', borderRadius: 7, border: `1.5px solid ${activeTab === 'bestseller' ? '#D4A017' : HC.orangeMid}`, background: activeTab === 'bestseller' ? HC.goldLight : HC.orangeLight, color: activeTab === 'bestseller' ? HC.gold : HC.orangeDark, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Sửa</button>
                            <button onClick={() => handleVDelete(v)} style={{ padding: '4px 10px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
          <MiniPager page={vPage} total={totalVPages} onChange={setVPage} label={`Hiển thị ${(vPage - 1) * VENDOR_PAGE_SIZE + 1}–${Math.min(vPage * VENDOR_PAGE_SIZE, filteredVendors.length)} / ${filteredVendors.length} vendor`} />
        </div>
      )}

      <ImportConfirmModal />

      {vendorModalOpen && (
        <div onClick={closeVendorModal} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 700, maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', background: HC.surface, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1.5px solid ${HC.border}` }}>
            <div style={{ padding: '18px 24px', background: activeTab === 'bestseller' ? `linear-gradient(135deg, #FFD700, #FFA500)` : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>{vendorModalMode === 'edit' ? '✏️' : (activeTab === 'bestseller' ? '⭐' : '➕')}</span>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>{vendorModalMode === 'edit' ? 'Sửa Vendor' : (activeTab === 'bestseller' ? 'Tạo Best Seller Vendor' : 'Thêm mới Vendor')}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{vendorModalMode === 'edit' ? 'Chỉnh sửa thông tin nhà cung cấp' : 'Nhập thông tin nhà cung cấp mới'}</div>
                </div>
              </div>
              <button onClick={closeVendorModal} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Vendor Name</label>
                <input type="text" value={vForm.name} onChange={vf('name')} placeholder="Tên nhà cung cấp..." style={inp3} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Product Type <span style={{ color: HC.danger }}>*</span></label>
                  <input type="text" value={vForm.product_type} onChange={vf('product_type')} placeholder="VD: Áo thun..." style={inp3} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Vendor Type <span style={{ color: HC.danger }}>*</span></label>
                  <select value={vForm.vendor_type} onChange={vf('vendor_type')} style={inp3}>
                    <option value="">-- Chọn --</option>
                    {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Size</label>
                  <input type="text" value={vForm.size} onChange={vf('size')} placeholder="VD: M, L, XL..." style={inp3} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Optional</label>
                  <input type="text" value={vForm.optional} onChange={vf('optional')} placeholder="Tùy chọn..." style={inp3} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Pricing <span style={{ color: HC.danger }}>*</span></label>
                  <input type="number" step="0.01" min="0" value={vForm.pricing} onChange={vf('pricing')} placeholder="0.00" style={inp3} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 12, display: 'block' }}>🚚 Phương thức vận chuyển</div>
                {[
                  { label: 'Economy', priceKey: 'eco_price', totalKey: 'eco_total', color: '#16a34a' },
                  { label: 'Fast', priceKey: 'fast_price', totalKey: 'fast_total', color: '#f59e0b' },
                  { label: 'Express', priceKey: 'express_price', totalKey: 'express_total', color: '#3b82f6' },
                  { label: 'Overnight', priceKey: 'overnight_price', totalKey: 'overnight_total', color: '#8b5cf6' }
                ].map((method, idx) => (
                  <div key={idx} style={{ marginBottom: 12, padding: '12px', background: HC.surface2, borderRadius: 12, border: `1px solid ${HC.border}` }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: method.color, marginBottom: 8 }}>🚚 {method.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: HC.muted, marginBottom: 4, display: 'block' }}>Price Ship</label>
                        <input type="number" step="0.01" min="0" value={vForm[method.priceKey]} onChange={vf(method.priceKey)} placeholder="0.00" style={inp3} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: HC.muted, marginBottom: 4, display: 'block' }}>Total (fulfill)</label>
                        <input type="number" step="0.01" min="0" value={vForm[method.totalKey]} onChange={vf(method.totalKey)} placeholder="0.00" style={inp3} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: `1.5px solid ${HC.border}`, background: HC.cream, borderRadius: '0 0 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
              <button onClick={closeVendorModal} style={{ padding: '10px 24px', borderRadius: 10, background: HC.surface, border: `1.5px solid ${HC.border}`, color: HC.brown, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleVSubmit} disabled={submitting} style={{ padding: '10px 28px', borderRadius: 10, background: submitting ? HC.muted2 : (activeTab === 'bestseller' ? `linear-gradient(135deg, #FFD700, #FFA500)` : `linear-gradient(135deg, ${HC.success}, #15803d)`), color: submitting ? '#fff' : (activeTab === 'bestseller' ? '#7A5C00' : '#fff'), border: 'none', fontSize: 13, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {submitting ? '⟳ Đang xử lý...' : (vendorModalMode === 'edit' ? '✓ Cập nhật' : '💾 Lưu Vendor')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, backdropFilter: 'blur(4px)' }}>
          <div style={{ width: 400, background: '#fff', borderRadius: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', textAlign: 'center', background: 'linear-gradient(135deg, #fef2f2, #fff)', borderBottom: '1px solid #fecaca' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28 }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#dc2626' }}>Xóa Vendor</h3>
              <p style={{ fontSize: 12, color: '#7a5c32', marginTop: 6 }}>Hành động không thể hoàn tác</p>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ background: '#fef3dc', borderRadius: 12, padding: '14px', textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#e09415' }}>{vendorToDelete?.vendor_type || '—'}</div>
                <div style={{ fontSize: 11, color: '#9c7a50', marginTop: 4 }}>{vendorToDelete?.product_type || '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setDeleteModalOpen(false); setVendorToDelete(null); }} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e8d4a8', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
                <button onClick={() => confirmDelete()} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Xóa</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300, animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards' }}>
          <div style={{ background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, borderRadius: 12, boxShadow: HC.shadowStrong, minWidth: 280, maxWidth: 380 }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>{toast.type === 'success' ? '✅' : '🔔'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 13, fontFamily: "'Nunito',sans-serif", marginBottom: 2, color: '#fff' }}>{toast.title}</div>
                <div style={{ fontSize: 11, opacity: 0.9, fontFamily: "'Nunito Sans',sans-serif", lineHeight: 1.4, color: '#fff' }}>{toast.message}</div>
              </div>
              <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: 4, opacity: 0.7 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>✕</button>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.5)', animation: `progressBar ${(toast.duration || 5000) / 1000}s linear forwards`, transformOrigin: 'left' }} />
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; transform: translateX(100%); } }
        @keyframes progressBar { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  );
}
