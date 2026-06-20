import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { vendorApi, productApi } from '../../../services/api';
import { HC, LS_PRODUCT_VENDORS, VENDOR_TYPES, VENDOR_PAGE_SIZE } from '../utils/constants';
import { lsGet, lsSet, parseVendorExcel, buildVendorPayload, VENDOR_TYPE_LIST, normalizeVendorType } from '../utils/helpers';
import { Spinner, EmptyState, BestSellerBadge } from '../ui/StaffBUI';
import { SearchOutlined } from '@ant-design/icons';
import VendorLibraryViewer from './VendorLibraryViewer';
import AppToast from '../../shared/AppToast';

export default function VendorsSection({ filterProductType = '', filterProductId = '', onClearFilter, onAssignComplete }) {
  const [activeTab, setActiveTab] = useState('all'); 
  const EMPTY_VENDOR = {
    name: '', vendor_type: '', product_type: '', size: '', optional: '', overview: '',
    avg_time_vendor: '', avg_time_actual: '', notes: '',
    media_url: '', pricing1: '', pricing2: '',
    eco_price: '', eco_total: '', fast_price: '', fast_total: '',
    express_price: '', express_total: '', overnight_price: '', overnight_total: ''
  };

  const [vendorList, setVendorList] = useState([]);
  const [excelVendors, setExcelVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState(null);
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);
  const [vForm, setVForm] = useState(EMPTY_VENDOR);
  const [editingVId, setEditingVId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [vPage, setVPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bestSellerIds, setBestSellerIds] = useState(() => {
    try {
      const saved = localStorage.getItem('BEST_SELLER_IDS_V1');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });
  const [showOnlyBestSeller, setShowOnlyBestSeller] = useState(false);
  const importFileRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreviewPage, setImportPreviewPage] = useState(1);
  const [importResult, setImportResult] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const vf = key => e => setVForm(p => ({ ...p, [key]: e.target.value }));
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorModalMode, setVendorModalMode] = useState('create');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [modalMediaUrls, setModalMediaUrls] = useState([]);
  const [viewingMediaFor, setViewingMediaFor] = useState(null);
  const mediaUploadRef = useRef(null);

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
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (vendorList.length > 0) {
      const saved = localStorage.getItem('BEST_SELLER_IDS_V1');
      if (!saved) {
        const ids = new Set(vendorList.filter(v => v.vendor_type === 'Best Seller').map(v => String(v.id)));
        setBestSellerIds(ids);
        if (ids.size > 0) localStorage.setItem('BEST_SELLER_IDS_V1', JSON.stringify([...ids]));
      }
    }
  }, [vendorList]);

  const bestSellerSorted = [...vendorList].sort((a, b) => (bestSellerIds.has(String(b.id)) ? 1 : 0) - (bestSellerIds.has(String(a.id)) ? 1 : 0));
  let filteredVendors = activeTab === 'bestseller'
    ? (showOnlyBestSeller ? vendorList.filter(v => bestSellerIds.has(String(v.id))) : bestSellerSorted)
    : vendorList;

  if (filterProductType) {
    filteredVendors = filteredVendors.filter(v => (v.product_type || '').toLowerCase().includes(filterProductType.toLowerCase()));
  }
  if (searchFilter && !filterProductType) {
    filteredVendors = filteredVendors.filter(v => (v.product_type || '').toLowerCase().includes(searchFilter.toLowerCase()));
  }

  const totalVPages = Math.ceil(filteredVendors.length / VENDOR_PAGE_SIZE);
  const pagedVendors = filteredVendors.slice((vPage - 1) * VENDOR_PAGE_SIZE, vPage * VENDOR_PAGE_SIZE);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllInFile = useCallback((ids) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      const allSelected = ids.every(id => n.has(id));
      if (allSelected) { ids.forEach(id => n.delete(id)); }
      else { ids.forEach(id => n.add(id)); }
      return n;
    });
  }, []);
  const toggleAll = () => {
    const pageIds = pagedVendors.map(v => v.id);
    const allSel = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => { const n = new Set(prev); if (allSel) { pageIds.forEach(id => n.delete(id)); } else { pageIds.forEach(id => n.add(id)); } return n; });
  };
  const toggleBestSeller = (vendorId) => {
    setBestSellerIds(prev => {
      const n = new Set(prev);
      const sid = String(vendorId);
      if (n.has(sid)) n.delete(sid);
      else n.add(sid);
      localStorage.setItem('BEST_SELLER_IDS_V1', JSON.stringify([...n]));
      return n;
    });
  };

  const pageAllSelected = pagedVendors.length > 0 && pagedVendors.every(v => selectedIds.has(v.id));
  const pageSomeSelected = pagedVendors.some(v => selectedIds.has(v.id));
  
  const selectedVendorsList = vendorList.filter(v => selectedIds.has(v.id));
  const uniqueSelectedCount = new Set(selectedVendorsList.map(v => ((v.name || v.vendor_type || '—') || '').toString().trim())).size;


  const openAssignConfirm = () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', msg: 'Vui lòng chọn ít nhất 1 vendor!' });
      return;
    }
    setAssignConfirmOpen(true);
  };

  const handleAssignVendor = () => {
    if (selectedIds.size === 0) return;
    
    let selected = vendorList.filter(v => selectedIds.has(v.id));
    
    if (activeTab === 'all') {
      const excelSelected = [];
      excelVendors.forEach(file => {
        if (file.generalInfo) {
          const matched = file.generalInfo.filter(r => selectedIds.has(r.id));
          matched.forEach(m => {
            excelSelected.push({
              id: m.id,
              name: m.kyHieu || 'Excel Vendor',
              product_type: m.kyHieu || '',
              vendor_type: 'New',
              overview: m.chatLieu || '',
              size: m.chiTietSize || '',
              media_url: (m.images && m.images.length > 0) ? m.images[0] : '',
              is_excel: true
            });
          });
        }
      });
      selected = excelSelected;
    }

    const productId = filterProductId;
    if (!productId) { setToast({ type: 'error', msg: 'Không xác định được sản phẩm.' }); setAssignConfirmOpen(false); return; }
    
    if (selected.length === 0) {
      setToast({ type: 'error', msg: 'Không tìm thấy dữ liệu vendor đã chọn.' });
      setAssignConfirmOpen(false);
      return;
    }

    const all = lsGet(LS_PRODUCT_VENDORS, {}); all[productId] = selected; lsSet(LS_PRODUCT_VENDORS, all);
    window.dispatchEvent(new StorageEvent('storage', { key: LS_PRODUCT_VENDORS }));

    // Đồng bộ lên API để các thiết bị khác nhận được
    productApi.assignVendors(productId, selected).catch(err => {
      console.error('Lỗi đồng bộ vendor lên API:', err);
    });

    setToast({ type: 'success', msg: `✅ Đã gán ${selected.length} vendor cho sản phẩm!` });
    setSelectedIds(new Set());
    setAssignConfirmOpen(false);
    onAssignComplete();
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
      'Vendor Name', 'Product Type', 'Thông tin tổng quan', 'Image URL', 'Size', 'Optional',
      'Pricing 1', 'Pricing 2', 'Economy Price Ship', 'Economy Total',
      'Fast Price Ship', 'Fast Total', 'Express Price Ship', 'Express Total',
      'Overnight Price Ship', 'Overnight Total'
    ];

    const selectedVendors = vendorList.filter(v => selectedIds.has(v.id));
    const hasSelection = selectedVendors.length > 0;

    let exportData = [];
    if (hasSelection) {
      // Có tick → export những vendor đã chọn
      exportData = selectedVendors.map(v => ({
        'Vendor Name': v.name || v.vendor_name || '',
        'Product Type': v.product_type || '',
        'Thông tin tổng quan': v.overview || '',
        'Image URL': v.media_url || '',
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
      // Không tick → export file trắng chỉ có tiêu đề (template)
      const emptyRow = {};
      columns.forEach(col => { emptyRow[col] = ''; });
      exportData = [emptyRow];
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
      { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
    ];
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Arial' },
      fill: { fgColor: { rgb: activeTab === 'bestseller' ? 'D4A017' : 'F59E0B' }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: 'CCCCCC' } }, bottom: { style: 'thin', color: { rgb: 'CCCCCC' } }, left: { style: 'thin', color: { rgb: 'CCCCCC' } }, right: { style: 'thin', color: { rgb: 'CCCCCC' } } }
    };
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:Q1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[address]) continue;
      ws[address].s = headerStyle;
    }
    // Nếu export template (không tick), xóa dòng dữ liệu trống, chỉ giữ header
    if (!hasSelection) {
      // Xóa row dữ liệu (row index 1), chỉ giữ header (row index 0)
      const ref = XLSX.utils.decode_range(ws['!ref']);
      for (let C = ref.s.c; C <= ref.e.c; ++C) {
        const cellAddr = XLSX.utils.encode_cell({ r: 1, c: C });
        delete ws[cellAddr];
      }
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'bestseller' ? 'Best_Seller' : 'Vendors');
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = hasSelection
      ? `Vendors_Export_${ts}.xlsx`
      : `Vendor_Template_${ts}.xlsx`;
    XLSX.writeFile(wb, filename);

    if (!hasSelection) {
      alert('📋 Đã tải file Excel mẫu (template)! Hãy điền dữ liệu và Import lại.');
    } else {
      alert(`✅ Đã xuất ${selectedVendors.length} vendor đã chọn ra file Excel!`);
    }
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
    
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await vendorApi.importBulk(formData);
      alert(res.data?.message || 'Import thành công!');
      loadVendors();
    } catch (err) {
      alert('Lỗi import: ' + getDetailedError(err));
    } finally {
      setImporting(false);
    }
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
        size: vForm.size || '', optional: vForm.optional || '',
        overview: vForm.overview || '',
        avg_time_vendor: vForm.avg_time_vendor || '',
        avg_time_actual: vForm.avg_time_actual || '',
        notes: vForm.notes || '',
        media_url: vForm.media_url || '',
        pricing1: vForm.pricing1 ? parseFloat(vForm.pricing1) : pricing1,
        pricing2: vForm.pricing2 ? parseFloat(vForm.pricing2) : pricing2,
        eco_price: vForm.eco_price ? parseFloat(vForm.eco_price) : null, eco_total: vForm.eco_total ? parseFloat(vForm.eco_total) : null,
        fast_price: vForm.fast_price ? parseFloat(vForm.fast_price) : null, fast_total: vForm.fast_total ? parseFloat(vForm.fast_total) : null,
        express_price: vForm.express_price ? parseFloat(vForm.express_price) : null, express_total: vForm.express_total ? parseFloat(vForm.express_total) : null,
        overnight_price: vForm.overnight_price ? parseFloat(vForm.overnight_price) : null, overnight_total: vForm.overnight_total ? parseFloat(vForm.overnight_total) : null,
      };
      if (editingVId !== null) {
        await vendorApi.update(editingVId, dataToSend);
        alert('✅ Cập nhật vendor thành công!');
      } else {
        const res = await vendorApi.create(dataToSend);
        const newVendorId = res.data?.data?.id;
        // Upload ảnh pending nếu có
        if (newVendorId && vForm._pendingFiles && vForm._pendingFiles.length > 0) {
          try {
            const formData = new FormData();
            vForm._pendingFiles.forEach(f => formData.append('media[]', f));
            await vendorApi.uploadMedia(newVendorId, formData);
          } catch (uploadErr) {
            console.warn('Upload media sau khi tạo vendor thất bại:', uploadErr);
          }
        }
        alert('✅ Tạo vendor thành công!');
      }
      await loadVendors(); closeVendorModal();
    } catch (err) { alert('Lỗi: ' + getDetailedError(err)); } finally { setSubmitting(false); }
  };

  const handleVEdit = vendor => openEditVendorModal(vendor);
  const handleVDelete = async (vendor) => { setVendorToDelete(vendor); setDeleteModalOpen(true); };
  
  const openCreateVendorModal = () => { setVForm(EMPTY_VENDOR); setEditingVId(null); setVendorModalMode('create'); setModalMediaUrls([]); setVendorModalOpen(true); };
  const openEditVendorModal = (vendor) => {
    setVForm({
      name: vendor.name || '', product_type: vendor.product_type || '', vendor_type: vendor.vendor_type || '',
      size: vendor.size || '', optional: vendor.optional || '',
      overview: vendor.overview || '',
      avg_time_vendor: vendor.avg_time_vendor || '',
      avg_time_actual: vendor.avg_time_actual || '',
      notes: vendor.notes || '',
      media_url: vendor.media_url || '',
      pricing1: vendor.pricing1 ?? '',
      pricing2: vendor.pricing2 ?? '',
      eco_price: vendor.eco_price ?? '', eco_total: vendor.eco_total ?? '',
      fast_price: vendor.fast_price ?? '', fast_total: vendor.fast_total ?? '',
      express_price: vendor.express_price ?? '', express_total: vendor.express_total ?? '',
      overnight_price: vendor.overnight_price ?? '', overnight_total: vendor.overnight_total ?? ''
    });
    setModalMediaUrls(Array.isArray(vendor.media_urls) ? vendor.media_urls : (vendor.media_url ? [vendor.media_url] : []));
    setEditingVId(vendor.id); setVendorModalMode('edit'); setVendorModalOpen(true);
  };
  const closeVendorModal = () => { setVendorModalOpen(false); setVForm(EMPTY_VENDOR); setEditingVId(null); setVendorModalMode('create'); setModalMediaUrls([]); };
  
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
  const PREVIEW_COLS = ['Vendor Name', 'Product Type', 'Vendor Type', 'Image URL', 'Overview', 'Size', 'Pricing 1', 'Eco Total', 'Fast Total'];
  const getCell = (v, col) => {
    const map = {
      'Vendor Name': v.name || v.vendor_name || v['Vendor Name'] || '', 'Product Type': v.product_type || v['Product Type'] || '',
      'Vendor Type': v.vendor_type || v['Vendor Type'] || '', 'Image URL': v.media_url || v['Image URL'] || '', 'Overview': v.overview || v.Overview || '', 'Size': v.size || v.Size || '',
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
    </button>
  );

  return (
    <div>
      {/* Assign Confirm Modal */}
      {assignConfirmOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 32px', width: 400, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 18, color: HC.ink, fontWeight: 900 }}>Xác nhận gán Vendor</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: HC.muted }}>Bạn có chắc chắn muốn gán <b>{selectedIds.size}</b> vendor đã chọn cho sản phẩm này không?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setAssignConfirmOpen(false)} style={{ padding: '10px 24px', borderRadius: 10, border: `1.5px solid ${HC.border}`, background: HC.surface, color: HC.muted, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleAssignVendor} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: HC.success, color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer' }}>Gán Vendor</button>
            </div>
          </div>
        </div>
      )}

      <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportFile} />
      {apiError && <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>⚠️ {apiError}</span><button onClick={loadVendors} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button></div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: `1.5px solid ${HC.border}`, paddingBottom: 8 }}>
        <TabButton id="all" label="Tổng quan Vendor & Sản phẩm" />
        <TabButton id="new_products" label="Sản phẩm mới" />
        <TabButton id="bestseller" label="Best Seller" />
      </div>

      {/* ── Thư Viện File tab (now Tất cả Vendor và Sản phẩm mới) ───────────────────────── */}
      {activeTab === 'new_products' && <VendorLibraryViewer mode="new_products" />}
      {activeTab === 'all' && (
        <>
          {filterProductType && (
            <div style={{ marginBottom: 14, padding: '12px 18px', borderRadius: 12, background: `linear-gradient(135deg,#e0f2fe,#bae6fd)`, border: `1.5px solid #38bdf8`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 13, color: '#0369a1' }}>Đang tìm vendor cho: <span style={{ color: '#0c4a6e' }}>"{filterProductType}"</span></div>
                <div style={{ fontSize: 11, color: '#075985', marginTop: 2 }}>Tích chọn dòng trong file Excel rồi nhấn <b>Gán Vendor</b></div>
              </div>
              {selectedIds.size > 0 && filterProductId && (
                <button onClick={openAssignConfirm} style={{ padding: '8px 16px', borderRadius: 8, background: HC.success, color: '#fff', border: 'none', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                  ✅ Gán {selectedIds.size} Vendor
                </button>
              )}
              <button onClick={onClearFilter} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid #0284c7`, background: '#fff', color: '#0284c7', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕ Bỏ lọc</button>
            </div>
          )}
          <VendorLibraryViewer mode="all" selectable={true} selectedIds={selectedIds} onSelectRow={toggleSelect} onSelectAll={selectAllInFile} onLibraryLoaded={setExcelVendors} />
        </>
      )}

      {activeTab === 'bestseller' && (
        <>
          {filterProductType && (
            <div style={{ marginBottom: 14, padding: '12px 18px', borderRadius: 12, background: `linear-gradient(135deg,#fef08a,#fde047)`, border: `1.5px solid #eab308`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>⭐</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 13, color: '#854d0e' }}>Đang tìm vendor cho: <span style={{ color: '#713f12' }}>"{filterProductType}"</span></div>
                <div style={{ fontSize: 11, color: '#a16207', marginTop: 2 }}>Tích chọn dòng trong danh sách Best Seller rồi nhấn <b>Gán Vendor</b></div>
              </div>
              {selectedIds.size > 0 && filterProductId && (
                <button onClick={openAssignConfirm} style={{ padding: '8px 16px', borderRadius: 8, background: HC.success, color: '#fff', border: 'none', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                  ✅ Gán {selectedIds.size} Vendor
                </button>
              )}
              <button onClick={onClearFilter} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid #eab308`, background: '#fff', color: '#ca8a04', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕ Bỏ lọc</button>
            </div>
          )}
          <VendorLibraryViewer mode="bestseller" selectable={true} selectedIds={selectedIds} onSelectRow={toggleSelect} onSelectAll={selectAllInFile} onLibraryLoaded={setExcelVendors} />
        </>
      )}

      <ImportConfirmModal />

      {/* ── Sticky floating assign bar ─────────────────────────────────────── */}
      {filterProductId && selectedIds.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1500, display: 'flex', alignItems: 'center', gap: 12,
          background: activeTab === 'bestseller'
            ? 'linear-gradient(135deg,#b45309,#92400e)'
            : `linear-gradient(135deg,${HC.orangeDark},#b45309)`,
          borderRadius: 16, padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.15)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(8px)',
          animation: 'slideUpBar 0.25s ease-out',
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              {activeTab === 'bestseller' ? '⭐' : '📋'}
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, color: '#fff', fontFamily: "'Nunito',sans-serif", lineHeight: 1 }}>
                {selectedIds.size} vendor đã chọn
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {filterProductType ? `cho "${filterProductType}"` : 'sẵn sàng gán'}
              </div>
            </div>
          </div>
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />
          <button
            onClick={openAssignConfirm}
            style={{
              padding: '9px 20px', borderRadius: 10,
              background: '#fff', color: HC.orangeDark,
              border: 'none', fontSize: 13, fontWeight: 900,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
          >
            ✅ Gán {selectedIds.size} Vendor
          </button>
          <button
            onClick={onClearFilter}
            style={{ padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Bỏ lọc
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUpBar {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);   opacity: 1; }
        }
      `}</style>

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
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                  📷 Hình ảnh / Video sản phẩm
                  <span style={{ fontSize: 11, color: HC.muted, fontWeight: 600, marginLeft: 8 }}>Ảnh đầu tiên sẽ làm ảnh đại diện</span>
                </label>

                {/* Hiển thị media đã upload */}
                {modalMediaUrls.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                    {modalMediaUrls.map((url, idx) => {
                      const isVideo = /\.(mp4|webm)$/i.test(url);
                      return (
                        <div key={idx} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: idx === 0 ? `2.5px solid ${HC.orange}` : `1.5px solid ${HC.border}`, width: 90, height: 90, flexShrink: 0 }}>
                          {idx === 0 && (
                            <span style={{ position: 'absolute', top: 3, left: 3, background: HC.orange, color: '#fff', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 99, zIndex: 2 }}>Thumbnail</span>
                          )}
                          {isVideo ? (
                            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                          ) : (
                            <img src={url} alt={`media-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                          <button
                            onClick={async () => {
                              if (editingVId) {
                                if (!window.confirm('Xóa ảnh này?')) return;
                                try {
                                  const res = await vendorApi.deleteMedia(editingVId, idx);
                                  setModalMediaUrls(res.data.media_urls || []);
                                  setVForm(p => ({ ...p, media_url: res.data.media_url || '' }));
                                  await loadVendors(true);
                                } catch { alert('Lỗi xóa media!'); }
                              } else {
                                const updated = modalMediaUrls.filter((_, i) => i !== idx);
                                setModalMediaUrls(updated);
                                setVForm(p => ({ ...p, media_url: updated[0] || '' }));
                              }
                            }}
                            style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                          >✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Upload button */}
                <input ref={mediaUploadRef} type="file" accept="image/*,video/mp4,video/webm" multiple style={{ display: 'none' }}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (mediaUploadRef.current) mediaUploadRef.current.value = '';
                    if (!files.length) return;

                    if (editingVId) {
                      // Đã có vendor ID → upload ngay lên server
                      setMediaUploading(true);
                      try {
                        const formData = new FormData();
                        files.forEach(f => formData.append('media[]', f));
                        const res = await vendorApi.uploadMedia(editingVId, formData);
                        setModalMediaUrls(res.data.media_urls || []);
                        setVForm(p => ({ ...p, media_url: res.data.media_url || p.media_url }));
                        await loadVendors(true);
                      } catch (err) { alert('Lỗi upload: ' + (err.response?.data?.message || err.message)); }
                      finally { setMediaUploading(false); }
                    } else {
                      // Chưa có vendor (tạo mới) → preview local bằng Object URL
                      const newUrls = files.map(f => URL.createObjectURL(f));
                      const combined = [...modalMediaUrls, ...newUrls];
                      setModalMediaUrls(combined);
                      setVForm(p => ({ ...p, media_url: combined[0] || p.media_url }));
                      // Lưu files để upload sau khi create xong
                      setVForm(p => ({ ...p, _pendingFiles: [...(p._pendingFiles || []), ...files] }));
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => mediaUploadRef.current?.click()}
                  disabled={mediaUploading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                    borderRadius: 10, border: `2px dashed ${HC.orangeMid}`,
                    background: HC.orangeLight, color: HC.orangeDark,
                    fontSize: 12, fontWeight: 800, cursor: mediaUploading ? 'not-allowed' : 'pointer',
                    opacity: mediaUploading ? 0.6 : 1, transition: 'all 0.2s',
                    width: '100%', justifyContent: 'center',
                  }}
                  onMouseEnter={e => { if (!mediaUploading) e.currentTarget.style.background = HC.orangeMid; }}
                  onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                >
                  {mediaUploading ? '⟳ Đang tải lên...' : '📁 Chọn ảnh / video từ máy tính'}
                </button>
                <div style={{ fontSize: 10, color: HC.muted, marginTop: 5, textAlign: 'center' }}>JPG, PNG, WEBP, GIF, MP4, WEBM • Tối đa 50MB/file</div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>🧵 Chất liệu (Overview)</label>
                <input type="text" value={vForm.overview} onChange={vf('overview')} placeholder="VD: Vải polyester, lưới thoáng khí..." style={inp3} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>⏱ AVG thời gian sx+ship (Vendor)</label>
                  <input type="text" value={vForm.avg_time_vendor} onChange={vf('avg_time_vendor')} placeholder="VD: Sx 2-4 bds, Ship 4-7 bds" style={inp3} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>⏱ AVG thời gian sx+ship (Thực tế)</label>
                  <input type="text" value={vForm.avg_time_actual} onChange={vf('avg_time_actual')} placeholder="VD: Update sau 5 tuần chạy phối" style={inp3} />
                </div>
              </div>
              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>📝 Notes</label>
                <input type="text" value={vForm.notes} onChange={vf('notes')} placeholder="Ghi chú thêm về vendor..." style={inp3} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Optional</label>
                  <input type="text" value={vForm.optional} onChange={vf('optional')} placeholder="Tùy chọn..." style={inp3} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Pricing 1 <span style={{ color: HC.danger }}>*</span></label>
                    <input type="number" step="0.01" min="0" value={vForm.pricing1} onChange={vf('pricing1')} placeholder="0.00" style={inp3} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>Pricing 2</label>
                    <input type="number" step="0.01" min="0" value={vForm.pricing2} onChange={vf('pricing2')} placeholder="0.00" style={inp3} />
                  </div>
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

      {viewingMediaFor && (
        <div onClick={() => setViewingMediaFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(5px)', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 800, background: HC.surface, borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '16px 24px', background: HC.ink, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900, color: '#fff', fontSize: 16 }}>Ảnh Vendor: {viewingMediaFor.name || viewingMediaFor.vendor_type}</div>
              <button onClick={() => setViewingMediaFor(null)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 24, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {(() => {
                const urls = Array.isArray(viewingMediaFor.media_urls) && viewingMediaFor.media_urls.length > 0 
                  ? viewingMediaFor.media_urls 
                  : (viewingMediaFor.media_url ? [viewingMediaFor.media_url] : []);
                
                if (urls.length === 0) return <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: HC.muted }}>Không có hình ảnh nào.</div>;
                
                return urls.map((url, idx) => {
                  const isVideo = /\.(mp4|webm)$/i.test(url);
                  return (
                    <div key={idx} style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${HC.border}`, aspectRatio: '1', background: '#000' }}>
                      {isVideo ? (
                        <video src={url} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <img src={url} alt={`Media ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      <AppToast toast={toast} onClose={() => setToast(null)} />
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}
