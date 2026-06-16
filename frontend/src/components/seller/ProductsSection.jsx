// ════════════════════════════════════════════════════════
//  PRODUCTS SECTION (Seller)
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
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
      production_time: product.production_time || '',
      shipping_time: product.shipping_time || '',
      total_cost: product.total_cost || '',
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
      errors.product_type = 'Vui lòng nhập Product Type';
    }
    if (!form.production_time?.trim()) {
      errors.production_time = 'Vui lòng nhập thời gian sản xuất';
    }
    if (!form.shipping_time?.trim()) {
      errors.shipping_time = 'Vui lòng nhập thời gian ship';
    }
    if (!form.total_cost?.trim()) {
      errors.total_cost = 'Vui lòng nhập Total Cost';
    }
    if (!form.product_type_links || form.product_type_links.length === 0) {
      errors.product_type_links = 'Vui lòng thêm ít nhất 1 link sản phẩm';
    }
    if (!form.material?.trim()) {
      errors.material = 'Vui lòng nhập chất liệu';
    }
    if (!form.print_area?.trim()) {
      errors.print_area = 'Vui lòng nhập vùng in/thiết kế';
    }
    if (!form.other_specs?.trim()) {
      errors.other_specs = 'Vui lòng nhập other đặc tính kỹ thuật';
    }
    if (!form.good_review?.trim()) {
      errors.good_review = 'Vui lòng nhập good review';
    }
    if (!form.bad_review?.trim()) {
      errors.bad_review = 'Vui lòng nhập bad review';
    }
    if (!form.packaging_links?.trim()) {
      errors.packaging_links = 'Vui lòng nhập packaging';
    }
    if (!form.other_packaging?.trim()) {
      errors.other_packaging = 'Vui lòng nhập other packaging';
    }
    if (!form.product_type_links || form.product_type_links.length === 0) {
      errors.product_type_links = 'Vui lòng cung cấp ít nhất 1 link sản phẩm';
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

  // Helper: chuẩn hoá links từ server response — dùng cho optimistic update
  const normalizeLinks = (p) => {
    let links = [];
    if (p.product_type_links) {
      if (Array.isArray(p.product_type_links)) links = p.product_type_links;
      else if (typeof p.product_type_links === 'string') {
        try { links = JSON.parse(p.product_type_links); } catch { links = [p.product_type_links]; }
      }
    } else if (p.product_type_link) links = [p.product_type_link];
    return { ...p, product_type_links: links, media_urls: p.media_urls || (p.media_url ? [p.media_url] : []) };
  };

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
    ['product_type', 'other_specs', 'material', 'print_area', 'good_review', 'bad_review', 'packaging_links', 'other_packaging', 'production_time', 'shipping_time', 'total_cost']
      .forEach(k => { if (form[k]) data.append(k, form[k]); });

    if (form.product_type_links && form.product_type_links.length > 0) {
      data.append('product_type_links', JSON.stringify(form.product_type_links));
    }

    if (user?.sellerName || user?.seller_name) {
      data.append('seller_name', user.sellerName || user.seller_name);
    }
    if (user?.project) {
      data.append('project', user.project);
    }

    form.mediaFiles.forEach(file => {
      data.append('media[]', file);
    });

    try {
      const res = await productApi.create(data);
      // Optimistic update: thêm sản phẩm mới vào đầu danh sách ngay lập tức
      const newProduct = normalizeLinks(res?.data?.data || {
        id: Date.now(),
        status: 'draft',
        created_at: new Date().toISOString(),
        product_type: form.product_type,
        other_specs: form.other_specs,
        material: form.material,
        print_area: form.print_area,
        good_review: form.good_review,
        bad_review: form.bad_review,
        packaging_links: form.packaging_links,
        other_packaging: form.other_packaging,
        production_time: form.production_time,
        shipping_time: form.shipping_time,
        total_cost: form.total_cost,
        product_type_links: form.product_type_links,
        seller_name: user?.sellerName || user?.seller_name,
        project: user?.project,
        media_urls: previewUrls,
      });
      setSubmittedProducts(prev => [newProduct, ...prev]);
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
      production_time: form.production_time,
      shipping_time: form.shipping_time,
      total_cost: form.total_cost,
      product_type_links: [...form.product_type_links],
    };
    const savedProductId = editingProduct.id;

    setSubmitting(true);
    const data = new FormData();
    ['product_type', 'other_specs', 'material', 'print_area', 'good_review', 'bad_review', 'packaging_links', 'other_packaging', 'production_time', 'shipping_time', 'total_cost']
      .forEach(k => { if (form[k]) data.append(k, form[k]); });

    if (form.product_type_links && form.product_type_links.length > 0) {
      data.append('product_type_links', JSON.stringify(form.product_type_links));
    }

    form.mediaFiles.forEach(file => { data.append('media[]', file); });

    try {
      await productApi.update(savedProductId, data);
      // Optimistic update: cập nhật local state ngay, không reload
      setSubmittedProducts(prev => prev.map(p =>
        p.id !== savedProductId ? p : { ...p, ...savedFormData }
      ));
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
      // Optimistic update: xóa khỏi local state ngay
      setSubmittedProducts(prev => prev.filter(p => p.id !== id));
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
      // Optimistic update: đổi status thành pending ngay lập tức
      setSubmittedProducts(prev => prev.map(p =>
        p.id === id ? { ...p, status: 'pending' } : p
      ));
      showToast('success', '📤 Đã gửi!', 'Form đã được gửi đến Admin để xét duyệt.');
    } catch (err) {
      showToast('error', '❌ Lỗi gửi!', err.response?.data?.message || err.message);
    } finally { setProcessingId(null); }
  };

  // Removed handleExport and handleImportProductsFile as requested

  const filteredProducts = submittedProducts.filter(p => {
    if (user?.project && p.project !== user.project && p.project) return false; // Lọc theo project (nếu có)
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
      {toast && (<div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, animation: 'slideIn 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards', maxWidth: 380 }}><div style={{ background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : toast.type === 'error' ? `linear-gradient(135deg, ${HC.danger}, #b91c1c)` : `linear-gradient(135deg, ${HC.warning}, #d97706)`, color: '#fff', borderRadius: 12, boxShadow: HC.shadowStrong, overflow: 'hidden' }}><div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 24 }}>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}</span><div><div style={{ fontWeight: 900, fontSize: 13 }}>{toast.title}</div><div style={{ fontSize: 11, opacity: 0.9 }}>{toast.message}</div></div><button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button></div><div style={{ height: 3, background: 'rgba(255,255,255,0.5)', animation: `progressBar ${(toast.duration || 5000) / 1000}s linear forwards`, transformOrigin: 'left' }} /></div></div>)}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: HC.ink }}>Danh Sách Sản Phẩm</h3>
        <div style={{ display: 'flex', gap: 10 }}>

          <button onClick={openCreateModal} style={{ padding: '9px 16px', borderRadius: 11, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Request sản phẩm mới</button>
        </div>
      </div>

      {apiError && <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700 }}>⚠️ {apiError}<button onClick={loadProducts} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer' }}>Thử lại</button></div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: '12px 16px', background: HC.surface, borderRadius: 14, border: `1.5px solid ${HC.border}` }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <SearchOutlined style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: HC.muted, fontSize: 14, pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Tìm loại sản phẩm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inp, paddingLeft: 36 }}
            onFocus={e => e.target.style.borderColor = HC.orange}
            onBlur={e => e.target.style.borderColor = HC.border}
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: '1 1 150px', minWidth: 130, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface2 }}>
          <option value="">Tất cả trạng thái</option>
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
                          {(isDraft || isRejected) && <button onClick={() => handleSendToAdmin(p.id)} disabled={processingId === p.id} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #bbf7d0', background: processingId === p.id ? '#d1fae5' : '#ecfdf5', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800, color: '#065f46' }}>{processingId === p.id ? '⟳ Đang gửi...' : '📤 Gửi Admin'}</button>}
                          {(isDraft || isRejected) && <button onClick={() => openEditModal(p)} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${HC.orangeMid}`, background: HC.orangeLight, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: HC.orangeDark }}>✏️ Sửa</button>}
                          {(isDraft || isRejected) && <button onClick={() => handleDelete(p.id)} disabled={processingId === p.id} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #fecaca', background: processingId === p.id ? '#fee2e2' : '#fef2f2', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800, color: HC.danger }}>{processingId === p.id ? '⟳ Đang xóa...' : '🗑 Xóa'}</button>}
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
                  {isEditing ? '✏️ Chỉnh sửa sản phẩm' : (() => {
                    const rawName = user?.project || user?.sellerName || user?.seller_name || user?.name || '';
                    let titleName = 'Project Global';
                    if (rawName) {
                      if (rawName.toLowerCase().includes('project')) {
                        const word = rawName.replace(/project/i, '').trim();
                        titleName = word ? `Project ${word}` : rawName;
                      } else {
                        titleName = rawName;
                      }
                    }
                    return `${titleName} Request - Product Type`;
                  })()}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                  {isEditing ? 'Cập nhật thông tin sản phẩm' : 'Điền đầy đủ thông tin để gửi request sản phẩm mới'}
                </div>
              </div>
              <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Modal Body */}
            <form onSubmit={isEditing ? handleUpdate : handleSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: 16 }}>
                <Field label="1. Product Type (Ghi rõ tên Product Type - Ví dụ: AOP Sweatshirt)" required error={formErrors.product_type}>
                  <input
                    type="text"
                    placeholder="Câu trả lời của bạn"
                    value={form.product_type}
                    onChange={fld('product_type')}
                    style={{
                      ...inp,
                      borderColor: formErrors.product_type ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Field label="1.1 Link hình ảnh và video (Nhiều link, sau mỗi link bấm enter)" required error={formErrors.product_type_links}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="url"
                      placeholder="Câu trả lời của bạn"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="1.2 Thời gian sản xuất mong muốn (Ví dụ: 1-3)" required error={formErrors.production_time}>
                  <input type="text" placeholder="Câu trả lời của bạn" value={form.production_time} onChange={fld('production_time')} style={{ ...inp, borderColor: formErrors.production_time ? HC.danger : HC.border }} />
                </Field>
                <Field label="1.3 Thời gian ship mong muốn (Ví dụ: 3-5)" required error={formErrors.shipping_time}>
                  <input type="text" placeholder="Câu trả lời của bạn" value={form.shipping_time} onChange={fld('shipping_time')} style={{ ...inp, borderColor: formErrors.shipping_time ? HC.danger : HC.border }} />
                </Field>
                <Field label="1.4 Total Cost (Bao gồm Base và Shipping cost)" required error={formErrors.total_cost}>
                  <input type="text" placeholder="Câu trả lời của bạn" value={form.total_cost} onChange={fld('total_cost')} style={{ ...inp, borderColor: formErrors.total_cost ? HC.danger : HC.border }} />
                </Field>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: HC.ink, marginBottom: 8 }}>2. Đặc tính kỹ thuật (Mô tả về đặc tính Product Type)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="2.1 Chất liệu (Ví dụ: 100% cotton)" required error={formErrors.material}>
                    <input type="text" placeholder="Câu trả lời của bạn" value={form.material} onChange={fld('material')} style={{ ...inp, borderColor: formErrors.material ? HC.danger : HC.border }} />
                  </Field>
                  <Field label="2.2 Vùng In/Thiết kế (Ví dụ: 2 vùng in trước và sau)" required error={formErrors.print_area}>
                    <input type="text" placeholder="Câu trả lời của bạn" value={form.print_area} onChange={fld('print_area')} style={{ ...inp, borderColor: formErrors.print_area ? HC.danger : HC.border }} />
                  </Field>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Field label="2.3 Other đặc tính kỹ thuật (Ngoài các thông tin trên)" required error={formErrors.other_specs}>
                  <textarea
                    placeholder="Câu trả lời của bạn"
                    value={form.other_specs}
                    onChange={fld('other_specs')}
                    style={{ ...inp, minHeight: 72, resize: 'vertical', borderColor: formErrors.other_specs ? HC.danger : HC.border }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="2.4 Good Review" required error={formErrors.good_review}>
                  <textarea
                    placeholder="Câu trả lời của bạn"
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
                <Field label="2.5 Bad Review" required error={formErrors.bad_review}>
                  <textarea
                    placeholder="Câu trả lời của bạn"
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

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: HC.ink, marginBottom: 8 }}>3. Packaging & đóng gói (Yêu cầu về đóng gói)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="3.1 Packaging (Ví dụ: Mỗi sản phẩm được đóng gói hộp xốp)" required error={formErrors.packaging_links}>
                    <input
                      type="text"
                      placeholder="Câu trả lời của bạn"
                      value={form.packaging_links}
                      onChange={fld('packaging_links')}
                      style={{
                        ...inp,
                        borderColor: formErrors.packaging_links ? HC.danger : HC.border
                      }}
                    />
                  </Field>
                  <Field label="3.2 Other Packaging (Phụ kiện đi kèm - Ví dụ: Thank you card)" required error={formErrors.other_packaging}>
                    <input
                      type="text"
                      placeholder="Câu trả lời của bạn"
                      value={form.other_packaging}
                      onChange={fld('other_packaging')}
                      style={{
                        ...inp,
                        borderColor: formErrors.other_packaging ? HC.danger : HC.border
                      }}
                    />
                  </Field>
                </div>
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

