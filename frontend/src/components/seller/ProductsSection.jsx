// ════════════════════════════════════════════════════════
//  PRODUCTS SECTION (Seller)
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { HC, STATUS_CFG, ITEMS_PER_PAGE, LS_PRODUCT_VENDORS, LS_A_SELECTIONS, EMPTY_FORM } from '../../constants/sellerTheme';
import { lsGet, fmtDate, getMediaUrls, getMediaUrl, exportProductsToExcel } from '../../utils/sellerHelpers';
import { parseSellerProductsExcel, exportProductsImportTemplate } from '../../utils/productExcel';
import { Spinner, EmptyState, Badge, Pagination, MediaGallery, inp, Field } from './SellerUI';
import { productApi } from '../../services/api';
import ProductViewerModal from './ProductViewerModal';

export default function ProductsSection({ highlightedProductId, onHighlightCleared }) {
  const { user } = useAuth();
  const [viewProduct, setViewProduct] = useState(null);
  const [submittedProducts, setSubmittedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);  // Đổi thành showFormModal
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({ ...EMPTY_FORM, mediaFiles: [] });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [productVendors, setProductVendors] = useState(() => lsGet(LS_PRODUCT_VENDORS, {}));
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const processedProductIdRef = useRef(null);
  const importFileRef = useRef(null);
  const [tempLink, setTempLink] = useState('');

  // Thêm link mới
  const addLink = () => {
    console.log("addLink clicked!", tempLink); // ✅ Thêm log để debug
    if (tempLink.trim()) {
      let url = tempLink.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      setForm(prev => ({
        ...prev,
        product_type_links: [...prev.product_type_links, url]
      }));
      setTempLink('');
    }
  };

  // Xóa link
  const removeLink = (indexToRemove) => {
    setForm(prev => ({
      ...prev,
      product_type_links: prev.product_type_links.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  // Mở link
  const openLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Reset form
  const resetForm = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setForm({ ...EMPTY_FORM, mediaFiles: [], product_type_links: [] });
    setPreviewUrls([]);
    setTempLink('');
    setFormErrors({});
    setIsEditing(false);
    setEditingProduct(null);
  };

  // Mở modal tạo mới
  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  // Mở modal chỉnh sửa
  const openEditModal = (product) => {
    setIsEditing(true);
    setEditingProduct(product);

    let links = [];
    if (product.product_type_links) {
      if (Array.isArray(product.product_type_links)) {
        links = product.product_type_links;
      } else if (typeof product.product_type_links === 'string') {
        try {
          links = JSON.parse(product.product_type_links);
        } catch {
          links = [product.product_type_links];
        }
      }
    } else if (product.product_type_link) {
      links = [product.product_type_link];
    }

    const existingMediaUrls = product.media_urls || (product.media_url ? [product.media_url] : []);
    setPreviewUrls(existingMediaUrls);
    setForm({
      deadline_date: product.deadline_date || '',
      product_type: product.product_type || '',
      mediaFiles: [],
      product_type_links: links,
      other_specs: product.other_specs || '',
      material: product.material || '',
      print_area: product.print_area || '',
      good_review: product.good_review || '',
      bad_review: product.bad_review || '',
      packaging_links: product.packaging_links || '',
      other_packaging: product.other_packaging || '',
    });
    setShowFormModal(true);
  };

  // Đóng modal
  const closeModal = () => {
    setShowFormModal(false);
    resetForm();
  };

  useEffect(() => {
    if (!highlightedProductId) return;

    const productId = parseInt(highlightedProductId, 10);
    console.log('🔍 Looking for product with ID:', productId);
    console.log('📋 Submitted products:', submittedProducts);

    const openProductModal = () => {
      const product = submittedProducts.find(p => String(p.id) === String(productId));
      if (product) {
        console.log('✅ Found product:', product);
        setViewProduct(product);
        if (onHighlightCleared) onHighlightCleared();
        return true;
      }
      return false;
    };

    if (submittedProducts.length > 0) {
      if (!openProductModal()) {
        console.log('⚠️ Product not found in current list, will retry...');
      }
      return;
    }

    let retryCount = 0;
    const maxRetries = 10;
    const interval = setInterval(() => {
      retryCount++;
      console.log(`🔄 Retry ${retryCount}/${maxRetries} to find product...`);

      if (submittedProducts.length > 0) {
        const product = submittedProducts.find(p => String(p.id) === String(productId));
        if (product) {
          clearInterval(interval);
          console.log('✅ Found product after retry:', product);
          setViewProduct(product);
          if (onHighlightCleared) onHighlightCleared();
        } else if (retryCount >= maxRetries) {
          clearInterval(interval);
          console.log('❌ Max retries reached, product not found');
        }
      } else if (retryCount >= maxRetries) {
        clearInterval(interval);
        console.log('❌ Max retries reached, no products loaded');
      }
    }, 500);

    return () => clearInterval(interval);
  }, [highlightedProductId, submittedProducts, onHighlightCleared]);

  const fld = key => e => {
    setForm(p => ({ ...p, [key]: e.target.value }));
    if (formErrors[key]) {
      setFormErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    setForm(prev => ({
      ...prev,
      mediaFiles: [...prev.mediaFiles, ...files]
    }));

    if (formErrors.media) {
      setFormErrors(prev => ({ ...prev, media: null }));
    }
  };

  const removeFile = (indexToRemove) => {
    URL.revokeObjectURL(previewUrls[indexToRemove]);
    setPreviewUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setForm(prev => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const validateForm = () => {
    const errors = {};

    if (!form.product_type?.trim()) {
      errors.product_type = 'Vui lòng nhập loại sản phẩm';
    }
    if (!form.product_type_links || form.product_type_links.length === 0) {
      errors.product_type_links = 'Vui lòng thêm ít nhất 1 link sản phẩm';
    }
    if (!form.other_specs?.trim()) {
      errors.other_specs = 'Vui lòng nhập đặc tính kỹ thuật';
    }
    if (!form.material?.trim()) {
      errors.material = 'Vui lòng nhập chất liệu';
    }
    if (!form.print_area?.trim()) {
      errors.print_area = 'Vui lòng nhập vùng in/thiết kế';
    }
    if (!form.good_review?.trim()) {
      errors.good_review = 'Vui lòng nhập good review';
    }
    if (!form.bad_review?.trim()) {
      errors.bad_review = 'Vui lòng nhập bad review';
    }
    if (form.mediaFiles.length === 0 && previewUrls.length === 0) {
      errors.media = 'Vui lòng chọn ít nhất 1 file media';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getStatus = p => { const s = p.status || 'draft'; return s === 'rejected' ? 'reject' : s; };

  const normalizeList = resp => {
    try {
      if (!resp) return [];
      const body = resp.data !== undefined ? resp.data : resp;
      if (Array.isArray(body?.data?.data)) return body.data.data;
      if (Array.isArray(body?.data)) return body.data;
      if (Array.isArray(body)) return body;
      return [];
    } catch { return []; }
  };

  const loadProducts = useCallback(() => {
    setLoading(true);
    setApiError('');
    return productApi.mySubmitted().then(r => {
      const data = normalizeList(r);
      console.log('📦 Loaded products from API:', data);

      const enriched = data.map(p => {
        let links = [];
        if (p.product_type_links) {
          if (Array.isArray(p.product_type_links)) {
            links = p.product_type_links;
          } else if (typeof p.product_type_links === 'string') {
            try { links = JSON.parse(p.product_type_links); }
            catch { links = [p.product_type_links]; }
          }
        } else if (p.product_type_link) {
          links = [p.product_type_link];
        }
        return {
          ...p,
          product_type_links: links,
          media_urls: p.media_urls || (p.media_url ? [p.media_url] : [])
        };
      });
      setSubmittedProducts(enriched);
      return enriched;
    })
      .catch(err => {
        setApiError(err.response?.data?.message || err.message || 'Lỗi tải dữ liệu');
        setSubmittedProducts([]);
        return [];
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const showToast = (type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', '❌ Thiếu thông tin', 'Vui lòng điền đầy đủ tất cả các trường bắt buộc');
      return;
    }

    setSubmitting(true);
    const data = new FormData();
    ['product_type', 'other_specs', 'material', 'print_area', 'good_review', 'bad_review', 'packaging_links', 'other_packaging']
      .forEach(k => { if (form[k]) data.append(k, form[k]); });

    if (form.product_type_links && form.product_type_links.length > 0) {
      data.append('product_type_links', JSON.stringify(form.product_type_links));
    }

    if (user?.sellerName || user?.seller_name) {
      data.append('seller_name', user.sellerName || user.seller_name);
      console.log('📤 Đang gửi seller_name:', user.sellerName || user.seller_name);
    }

    form.mediaFiles.forEach(file => {
      data.append('media[]', file);
    });

    for (let pair of data.entries()) {
      console.log(pair[0], pair[1]);
    }

    try {
      await productApi.create(data);
      await loadProducts();

      const savedFormLinks = [...form.product_type_links];
      const savedMaterial = form.material;
      const savedOtherSpecs = form.other_specs;
      const savedPrintArea = form.print_area;
      setSubmittedProducts(prev => prev.map((p, idx) => {
        if (idx !== 0) return p;
        return {
          ...p,
          material: savedMaterial || p.material,
          other_specs: savedOtherSpecs || p.other_specs,
          print_area: savedPrintArea || p.print_area,
          product_type_links: savedFormLinks.length ? savedFormLinks : p.product_type_links,
        };
      }));

      closeModal();
      showToast('success', '✅ Tạo mới thành công!', `Sản phẩm được tạo bởi: ${user?.sellerName || user?.seller_name || user?.email}`);
    } catch (err) {
      showToast('error', '❌ Lỗi tạo sản phẩm!', err.response?.data?.message || err.message || 'Không thể tạo sản phẩm');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async e => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', '❌ Thiếu thông tin', 'Vui lòng điền đầy đủ tất cả các trường bắt buộc');
      return;
    }

    const savedFormData = {
      product_type: form.product_type,
      other_specs: form.other_specs,
      material: form.material,
      print_area: form.print_area,
      good_review: form.good_review,
      bad_review: form.bad_review,
      packaging_links: form.packaging_links,
      other_packaging: form.other_packaging,
      product_type_links: [...form.product_type_links],
    };
    const savedProductId = editingProduct.id;

    setSubmitting(true);
    const data = new FormData();
    ['product_type', 'other_specs', 'material', 'print_area', 'good_review', 'bad_review', 'packaging_links', 'other_packaging']
      .forEach(k => { if (form[k]) data.append(k, form[k]); });

    if (form.product_type_links && form.product_type_links.length > 0) {
      data.append('product_type_links', JSON.stringify(form.product_type_links));
    }

    form.mediaFiles.forEach(file => { data.append('media[]', file); });

    try {
      await productApi.update(savedProductId, data);
      await loadProducts();

      setSubmittedProducts(prev => prev.map(p => {
        if (p.id !== savedProductId) return p;
        return { ...p, ...savedFormData };
      }));

      closeModal();
      showToast('success', '✅ Cập nhật thành công!', 'Sản phẩm đã được cập nhật.');
    } catch (err) {
      showToast('error', '❌ Lỗi cập nhật!', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async id => {
    setProcessingId(id);
    try {
      await productApi.delete(id);
      await loadProducts();
      setConfirmDeleteId(null);
      showToast('success', '🗑 Đã xóa!', 'Sản phẩm đã được xóa thành công.');
    } catch (err) {
      showToast('error', '❌ Lỗi xóa!', err.response?.data?.message || err.message);
    } finally { setProcessingId(null); }
  };

  const handleSendToAdmin = async id => {
    setProcessingId(id);
    try {
      await productApi.sendToAdmin(id);
      await loadProducts();
      showToast('success', '📤 Đã gửi!', 'Form đã được gửi đến Admin để xét duyệt.');
    } catch (err) {
      showToast('error', '❌ Lỗi gửi!', err.response?.data?.message || err.message);
    } finally { setProcessingId(null); }
  };

  const handleExport = async () => {
    if (!filteredProducts.length) {
      showToast('warning', '⚠️ Không có dữ liệu', 'Không có sản phẩm nào để xuất!');
      return;
    }
    showToast('success', '⏳ Đang xuất...', 'Đang tải thư viện Excel, vui lòng chờ...');
    const d = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
    await exportProductsToExcel(filteredProducts, productVendors, `products_${d}.xlsx`);
  };

  const handleDownloadImportTemplate = async () => {
    await exportProductsImportTemplate();
    showToast('success', '📄 Đã tải template', 'Bạn có thể điền dữ liệu rồi Import vào hệ thống.');
  };

  const handleImportProductsFile = async (e) => {
    const file = e.target.files?.[0];
    if (importFileRef.current) importFileRef.current.value = '';
    if (!file) return;
    if (!['xlsx', 'xls', 'csv'].includes(file.name.split('.').pop().toLowerCase())) {
      showToast('error', '❌ Sai định dạng', 'Vui lòng chọn file .xlsx/.xls/.csv');
      return;
    }

    let rows = [];
    try {
      rows = await parseSellerProductsExcel(file);
    } catch (err) {
      showToast('error', '❌ Lỗi đọc file', err.message || 'Không thể parse file Excel');
      return;
    }

    if (!rows.length) {
      showToast('warning', '⚠️ Không có dữ liệu', 'Không tìm thấy dòng sản phẩm hợp lệ trong file.');
      return;
    }

    setSubmitting(true);
    let ok = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const data = new FormData();
      data.append('product_type', row.product_type || '');
      if (row.deadline_date) data.append('deadline_date', row.deadline_date);
      if (row.other_specs) data.append('other_specs', row.other_specs);
      if (row.material) data.append('material', row.material);
      if (row.print_area) data.append('print_area', row.print_area);
      if (row.good_review) data.append('good_review', row.good_review);
      if (row.bad_review) data.append('bad_review', row.bad_review);
      if (row.packaging_links) data.append('packaging_links', row.packaging_links);
      if (row.other_packaging) data.append('other_packaging', row.other_packaging);
      if (row.product_type_links?.length) data.append('product_type_links', JSON.stringify(row.product_type_links));
      if (user?.sellerName || user?.seller_name) data.append('seller_name', user.sellerName || user.seller_name);

      try {
        await productApi.create(data);
        ok++;
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Không xác định';
        errors.push(`Dòng ${i + 1} (${row.product_type || 'N/A'}): ${msg}`);
      }
    }

    await loadProducts();
    setSubmitting(false);

    if (!errors.length) {
      showToast('success', '✅ Import thành công', `Đã import ${ok}/${rows.length} sản phẩm.`);
    } else {
      showToast('warning', '⚠️ Import hoàn tất có lỗi', `Thành công ${ok}/${rows.length}. Kiểm tra alert để xem lỗi.`);
      alert(`Import có lỗi:\n\n${errors.slice(0, 12).join('\n')}`);
    }
  };


  const filteredProducts = submittedProducts.filter(p => {
    const hay = `${p.product_type || ''} ${p.other_specs || ''}`.toLowerCase();
    const status = getStatus(p);
    return (!search || hay.includes(search.toLowerCase())) && (!filterStatus || status === filterStatus);
  });

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus]);
  const hasFilter = search || filterStatus;
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const renderVendorBadge = (p) => {
    const vendors = productVendors[p.id] || [];
    const aSelections = lsGet(LS_A_SELECTIONS, {})[p.id] || {};
    const selectedCount = Object.values(aSelections).filter(s => s?.checked).length;
    if (vendors.length === 0) return <span style={{ color: HC.muted2, fontSize: 11, fontStyle: 'italic' }}>Chưa gán</span>;
    return (<div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#ecfdf5', border: '1px solid #bbf7d0', fontSize: 11, fontWeight: 800, color: '#065f46' }}>Assigned · {vendors.length} vendor</span>{selectedCount > 0 && <span style={{ fontSize: 10, color: HC.success, marginLeft: 8 }}>✓ Đã chọn {selectedCount}</span>}</div>);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleImportProductsFile}
      />
      {toast && (<div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, animation: 'slideIn 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards', maxWidth: 380 }}><div style={{ background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : toast.type === 'error' ? `linear-gradient(135deg, ${HC.danger}, #b91c1c)` : `linear-gradient(135deg, ${HC.warning}, #d97706)`, color: '#fff', borderRadius: 12, boxShadow: HC.shadowStrong, overflow: 'hidden' }}><div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 24 }}>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}</span><div><div style={{ fontWeight: 900, fontSize: 13 }}>{toast.title}</div><div style={{ fontSize: 11, opacity: 0.9 }}>{toast.message}</div></div><button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button></div><div style={{ height: 3, background: 'rgba(255,255,255,0.5)', animation: `progressBar ${(toast.duration || 5000) / 1000}s linear forwards`, transformOrigin: 'left' }} /></div></div>)}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: HC.ink }}>Danh Sách Sản Phẩm</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleDownloadImportTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, background: HC.cream, color: HC.brown, border: `1.5px solid ${HC.border}`, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>📄 Template</button>
          <button onClick={() => importFileRef.current?.click()} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, background: submitting ? HC.muted2 : HC.warning, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? '⏳ Đang import...' : '📥 Import Excel'}</button>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, background: HC.success, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>⬇ Xuất Excel{hasFilter && <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '1px 6px', fontSize: 10 }}>{filteredProducts.length}</span>}</button>
          <button onClick={openCreateModal} style={{ padding: '9px 16px', borderRadius: 11, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>+ Tạo Sản Phẩm Mới</button>
        </div>
      </div>

      {apiError && <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700 }}>⚠️ {apiError}<button onClick={loadProducts} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer' }}>Thử lại</button></div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: '12px 16px', background: HC.surface, borderRadius: 14, border: `1.5px solid ${HC.border}` }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: HC.muted }}>🔍</span>
          <input type="text" placeholder="Tìm loại sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 34 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: '1 1 150px', minWidth: 130, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface2 }}>
          <option value="">Tất cả trạng thái</option>
          <option value="draft">Draft (Chưa gửi)</option>
          <option value="pending">Pending (Chờ duyệt)</option>
          <option value="approved">Approved (Đã duyệt)</option>
          <option value="reject">Rejected (Từ chối)</option>
        </select>
        {hasFilter && <button onClick={() => { setSearch(''); setFilterStatus(''); }} style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕ Xóa lọc</button>}
        <div style={{ fontSize: 11, color: HC.muted, fontWeight: 700 }}>{filteredProducts.length} / {submittedProducts.length} sản phẩm</div>
      </div>

      {filteredProducts.length === 0 ? <EmptyState msg={submittedProducts.length === 0 ? 'Chưa có sản phẩm nào. Hãy tạo sản phẩm mới!' : 'Không tìm thấy kết quả phù hợp'} /> : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 14, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, background: HC.surface }}>
              <thead>
                <tr>
                  {['STT', 'Product Type', 'Hình ảnh', 'Date Request', 'Deadline', 'Trạng thái', 'Lý do', 'Nhà phân phối', 'Thao tác'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: HC.brown, fontWeight: 900, borderBottom: `1.5px solid ${HC.border}`, fontSize: 10, textTransform: 'uppercase', background: HC.cream }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((p, i) => {
                  const mediaUrls = getMediaUrls(p);
                  const status = getStatus(p);
                  const isDraft = status === 'draft';
                  const isRejected = status === 'reject';
                  return (
                    <tr key={p.id || i} style={{ borderBottom: `1px solid ${HC.border}`, background: isRejected ? '#fef2f2' : 'transparent' }}>
                      <td style={{ padding: '12px 14px', color: HC.muted, fontWeight: 700 }}>{(currentPage - 1) * ITEMS_PER_PAGE + i + 1}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: HC.ink2 }}>{p.product_type || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <MediaGallery mediaUrls={mediaUrls} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>{fmtDate(p.created_at) || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>{fmtDate(p.deadline_date) || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <Badge status={status} />
                      </td>
                      <td style={{ padding: '12px 14px', maxWidth: 200, wordBreak: 'break-word' }}>
                        {isRejected ? (p.rejection_reason || p.reason || '—') : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{renderVendorBadge(p)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => setViewProduct(p)} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${HC.border}`, background: HC.cream, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: HC.brown }}>👁 Xem</button>
                          {isDraft && <button onClick={() => handleSendToAdmin(p.id)} disabled={processingId === p.id} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #bbf7d0', background: processingId === p.id ? '#d1fae5' : '#ecfdf5', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800, color: '#065f46' }}>{processingId === p.id ? '⟳ Đang gửi...' : '📤 Gửi Admin'}</button>}
                          {isDraft && <button onClick={() => openEditModal(p)} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${HC.orangeMid}`, background: HC.orangeLight, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: HC.orangeDark }}>✏️ Sửa</button>}
                          {isDraft && <button onClick={() => handleDelete(p.id)} disabled={processingId === p.id} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #fecaca', background: processingId === p.id ? '#fee2e2' : '#fef2f2', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800, color: HC.danger }}>{processingId === p.id ? '⟳ Đang xóa...' : '🗑 Xóa'}</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            onPageChange={setCurrentPage}
            itemsPerPage={20}
          />
        </>
      )}

      {/* MODAL TẠO/SỬA SẢN PHẨM */}
      {showFormModal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 900, maxHeight: '85vh', overflowY: 'auto', background: HC.surface, borderRadius: 20, boxShadow: HC.shadowStrong, border: `1.5px solid ${HC.border}` }}>

            {/* Modal Header */}
            <div style={{ padding: '16px 24px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>
                  {isEditing ? '✏️ Chỉnh sửa sản phẩm' : '➕ Thêm sản phẩm mới'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                  {isEditing ? 'Cập nhật thông tin sản phẩm' : 'Điền đầy đủ thông tin để tạo sản phẩm mới'}
                </div>
              </div>
              <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Modal Body */}
            <form onSubmit={isEditing ? handleUpdate : handleSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: 16 }}>
                <Field label="Product Type" required error={formErrors.product_type}>
                  <input
                    type="text"
                    placeholder="VD: Áo thun, Cốc sứ..."
                    value={form.product_type}
                    onChange={fld('product_type')}
                    style={{
                      ...inp,
                      borderColor: formErrors.product_type ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="Hình ảnh / Video (nhiều file)" required error={formErrors.media}>
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    multiple
                    onChange={handleFileChange}
                    style={{
                      ...inp,
                      padding: '7px 10px',
                      cursor: 'pointer',
                      borderColor: formErrors.media ? HC.danger : HC.border
                    }}
                  />
                  {previewUrls.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {previewUrls.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative', width: 70, height: 70, borderRadius: 8, overflow: 'hidden', border: `1px solid ${HC.border}`, background: '#2a1a00' }}>
                          {url.match(/\.(mp4|webm|mov)$/i) || url.includes('video') ? (
                            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                          <button type="button" onClick={() => removeFile(idx)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 20, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 10 }}><DeleteOutlined /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>

                <Field label="Product Type Link" required error={formErrors.product_type_links}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={tempLink}
                      onChange={e => setTempLink(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addLink()}
                      style={{
                        ...inp,
                        flex: 1,
                        borderColor: formErrors.product_type_links ? HC.danger : HC.border
                      }}
                    />
                    <button
                      type="button"
                      onClick={addLink}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 9,
                        background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      + Thêm link
                    </button>
                  </div>

                  {form.product_type_links.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {form.product_type_links.map((link, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: HC.orangeLight, borderRadius: 20, border: `1px solid ${HC.orangeMid}` }}>
                          <a href="#" onClick={(e) => { e.preventDefault(); openLink(link); }} style={{ color: HC.orangeDark, fontSize: 12, fontWeight: 600, textDecoration: 'none', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} title={link}>
                            🔗 {link.length > 40 ? link.substring(0, 40) + '...' : link}
                          </a>
                          <button type="button" onClick={() => removeLink(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: HC.danger, fontSize: 12, display: 'flex', alignItems: 'center', padding: 0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {formErrors.product_type_links && (
                    <span style={{ color: HC.danger, fontSize: 10, marginTop: 2 }}>⚠ {formErrors.product_type_links}</span>
                  )}
                </Field>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Field label="Đặc tính kĩ thuật" required error={formErrors.other_specs}>
                  <textarea
                    placeholder="Mô tả yêu cầu kỹ thuật..."
                    value={form.other_specs}
                    onChange={fld('other_specs')}
                    style={{
                      ...inp,
                      minHeight: 72,
                      resize: 'vertical',
                      borderColor: formErrors.other_specs ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="Chất liệu" required error={formErrors.material}>
                  <input
                    type="text"
                    placeholder="VD: Cotton 100%..."
                    value={form.material}
                    onChange={fld('material')}
                    style={{
                      ...inp,
                      borderColor: formErrors.material ? HC.danger : HC.border
                    }}
                  />
                </Field>
                <Field label="Vùng In/Thiết kế" required error={formErrors.print_area}>
                  <input
                    type="text"
                    placeholder="VD: Ngực trái, Full lưng..."
                    value={form.print_area}
                    onChange={fld('print_area')}
                    style={{
                      ...inp,
                      borderColor: formErrors.print_area ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="Good Review" required error={formErrors.good_review}>
                  <textarea
                    placeholder="Ưu điểm..."
                    value={form.good_review}
                    onChange={fld('good_review')}
                    style={{
                      ...inp,
                      minHeight: 70,
                      resize: 'vertical',
                      borderColor: formErrors.good_review ? HC.danger : HC.border
                    }}
                  />
                </Field>
                <Field label="Bad Review" required error={formErrors.bad_review}>
                  <textarea
                    placeholder="Nhược điểm..."
                    value={form.bad_review}
                    onChange={fld('bad_review')}
                    style={{
                      ...inp,
                      minHeight: 70,
                      resize: 'vertical',
                      borderColor: formErrors.bad_review ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <Field label="Packing">
                  <input
                    type="text"
                    placeholder="VD: Túi zip..."
                    value={form.packaging_links}
                    onChange={fld('packaging_links')}
                    style={{
                      ...inp,
                      borderColor: formErrors.packaging_links ? HC.danger : HC.border
                    }}
                  />
                </Field>
                <Field label="Other Packing">
                  <input
                    type="text"
                    placeholder="Đóng gói khác..."
                    value={form.other_packaging}
                    onChange={fld('other_packaging')}
                    style={{
                      ...inp,
                      borderColor: formErrors.other_packaging ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${HC.border}` }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    background: HC.cream,
                    border: `1.5px solid ${HC.border}`,
                    color: HC.brown,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    background: submitting ? HC.muted2 : `linear-gradient(135deg,${HC.success},#15803d)`,
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? '⟳ Đang xử lý...' : isEditing ? '✓ Cập nhật' : '💾 Lưu (Draft)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewProduct && <ProductViewerModal product={viewProduct} productVendors={productVendors} onClose={() => setViewProduct(null)} getStatus={getStatus} />}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; transform: translateX(100%); } }
        @keyframes progressBar { from { width: 100%; } to { width: 0%; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

