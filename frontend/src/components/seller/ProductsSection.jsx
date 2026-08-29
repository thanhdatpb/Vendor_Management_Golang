// ════════════════════════════════════════════════════════
//  PRODUCTS SECTION (Seller)
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';
import AppToast from '../shared/AppToast';
import { DeleteOutlined, SearchOutlined, SendOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { HC, STATUS_CFG, ITEMS_PER_PAGE, LS_PRODUCT_VENDORS, EMPTY_FORM } from '../../constants/sellerTheme';
import { lsGet, fmtDate, fmtDateTime, getMediaUrls, getMediaUrl, exportProductsToExcel } from '../../utils/sellerHelpers';
import { parseSellerProductsExcel, exportProductsImportTemplate } from '../../utils/productExcel';
import { Spinner, EmptyState, Badge, Pagination, MediaGallery, inp, Field, AutoGrowTextarea } from './SellerUI';
import { productApi } from '../../services/api';
import { subscribeProductChanges } from '../../services/echo';
import ProductViewerModal from './ProductViewerModal';
import useIsMobile from '../../hooks/useIsMobile';
import { vnDateStamp } from '../../utils/vnTime';

function ThumbnailCell({ src }) {
  const [broken, setBroken] = useState(false);
  const placeholder = (
    <div style={{ width: 60, height: 60, borderRadius: 12, background: '#f1f5f9', border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    </div>
  );
  if (!src || broken) return placeholder;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      style={{ width: 60, height: 60, borderRadius: 12, objectFit: 'cover', border: '1.5px solid #e2e8f0', display: 'block' }}
      onError={() => setBroken(true)}
    />
  );
}

function LinkPreviewImg({ src }) {
  const [err, setErr] = useState(false);
  return (
    <div style={{ width: '100%', height: 90, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {err ? (
        <span style={{ fontSize: 26, color: '#94a3b8' }}>🖼️</span>
      ) : (
        <img src={src} alt="" onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  );
}

export default function ProductsSection({ highlightedProductId, onHighlightCleared, onViewVendorLibrary }) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [viewProduct, setViewProduct] = useState(null);
  const [submittedProducts, setSubmittedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
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
  const [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const processedProductIdRef = useRef(null);
  const importFileRef = useRef(null);
  const fileUploadRef = useRef(null);
  const [tempLink, setTempLink] = useState('');
  const [tempVideoLink, setTempVideoLink] = useState('');

  // Xóa localStorage cũ khi API đã là source of truth
  useEffect(() => {
    localStorage.removeItem('STAFF_PRODUCT_VENDORS_V1');
    localStorage.removeItem('STAFF_B_NOTIFICATIONS');
    localStorage.removeItem('STAFF_A_NOTIFICATIONS');
    localStorage.removeItem('SELLER_NOTIFICATIONS');
  }, []);

  // Mở modal xem sản phẩm — fetch fresh từ API để lấy assigned_vendors mới nhất
  const handleViewProduct = useCallback(async (product) => {
    try {
      const res = await productApi.getById(product.id);
      const fresh = res.data?.data || product;
      setViewProduct(fresh);
    } catch {
      setViewProduct(product);
    }
  }, []);

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

  // Thêm video link
  const addVideoLink = () => {
    if (tempVideoLink.trim()) {
      let url = tempVideoLink.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      setForm(prev => ({
        ...prev,
        product_video_links: [...(prev.product_video_links || []), url]
      }));
      setTempVideoLink('');
    }
  };

  const removeVideoLink = (indexToRemove) => {
    setForm(prev => ({
      ...prev,
      product_video_links: (prev.product_video_links || []).filter((_, idx) => idx !== indexToRemove)
    }));
  };

  // Mở link
  const openLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Reset form
  const resetForm = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setForm({ ...EMPTY_FORM, mediaFiles: [], product_type_links: [], product_video_links: [] });
    setPreviewUrls([]);
    setTempLink('');
    setTempVideoLink('');
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

    let videoLinks = [];
    if (product.product_video_links) {
      if (Array.isArray(product.product_video_links)) {
        videoLinks = product.product_video_links;
      } else if (typeof product.product_video_links === 'string') {
        try {
          videoLinks = JSON.parse(product.product_video_links);
        } catch {
          videoLinks = [product.product_video_links];
        }
      }
    }

    const existingMediaUrls = product.media_urls || (product.media_url ? [product.media_url] : []);
    setPreviewUrls(existingMediaUrls);
    setForm({
      deadline_date: product.deadline_date || '',
      product_type: product.product_type || '',
      mediaFiles: [],
      product_type_links: links,
      product_video_links: videoLinks,
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
        handleViewProduct(product);
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

      if (submittedProducts.length > 0) {
        const product = submittedProducts.find(p => String(p.id) === String(productId));
        if (product) {
          clearInterval(interval);
          handleViewProduct(product);
          if (onHighlightCleared) onHighlightCleared();
        } else if (retryCount >= maxRetries) {
          clearInterval(interval);
          console.log('Max retries reached, product not found');
        }
      } else if (retryCount >= maxRetries) {
        clearInterval(interval);
        console.log('Max retries reached, no products loaded');
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
      errors.product_type_links = 'Vui lòng thêm ít nhất 1 link hình ảnh sản phẩm';
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
        let videoLinks = [];
        if (p.product_video_links) {
          if (Array.isArray(p.product_video_links)) {
            videoLinks = p.product_video_links;
          } else if (typeof p.product_video_links === 'string') {
            try { videoLinks = JSON.parse(p.product_video_links); }
            catch { videoLinks = [p.product_video_links]; }
          }
        }
        let assignedVendors = p.assigned_vendors || [];
        if (typeof assignedVendors === 'string') {
          try { assignedVendors = JSON.parse(assignedVendors); } catch { assignedVendors = []; }
        }
        if (!Array.isArray(assignedVendors)) assignedVendors = [];
        return {
          ...p,
          product_type_links: links,
          product_video_links: videoLinks,
          media_urls: p.media_urls || (p.media_url ? [p.media_url] : []),
          assigned_vendors: assignedVendors
        };
      });
      setSubmittedProducts(enriched);

      // Sync lên localStorage để VendorLibraryViewer (Seller) có thể lọc vendor đã gán
      try {
        localStorage.setItem('MOCK_PRODUCTS', JSON.stringify(enriched));
        const vendorMap = lsGet(LS_PRODUCT_VENDORS, {});
        enriched.forEach(p => {
          if (p.assigned_vendors && p.assigned_vendors.length > 0) {
            vendorMap[p.id] = p.assigned_vendors;
          }
        });
        localStorage.setItem(LS_PRODUCT_VENDORS, JSON.stringify(vendorMap));
      } catch {}

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
    let videoLinks = [];
    if (p.product_video_links) {
      if (Array.isArray(p.product_video_links)) videoLinks = p.product_video_links;
      else if (typeof p.product_video_links === 'string') {
        try { videoLinks = JSON.parse(p.product_video_links); } catch { videoLinks = [p.product_video_links]; }
      }
    }
    return { ...p, product_type_links: links, product_video_links: videoLinks, media_urls: p.media_urls || (p.media_url ? [p.media_url] : []) };
  };

  useEffect(() => {
    loadProducts();
    // Real-time: khi Admin duyệt/từ chối, hoặc chính mình sửa từ tab/thiết bị khác,
    // danh sách tự cập nhật ngay — không cần F5.
    const unsubscribe = subscribeProductChanges(() => { loadProducts(); });
    return unsubscribe;
  }, [loadProducts]);

  const showToast = (type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', 'Thiếu thông tin', 'Vui lòng điền đầy đủ tất cả các trường bắt buộc');
      return;
    }

    setSubmitting(true);
    const data = new FormData();
    ['product_type', 'other_specs', 'material', 'print_area', 'good_review', 'bad_review', 'packaging_links', 'other_packaging', 'production_time', 'shipping_time', 'total_cost']
      .forEach(k => { if (form[k]) data.append(k, form[k]); });

    if (form.product_type_links && form.product_type_links.length > 0) {
      data.append('product_type_links', JSON.stringify(form.product_type_links));
    }
    if (form.product_video_links && form.product_video_links.length > 0) {
      data.append('product_video_links', JSON.stringify(form.product_video_links));
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
      const createdData = res?.data?.data || res?.data;

      // Optimistic update: thêm sản phẩm mới vào đầu danh sách ngay lập tức ở trạng thái draft
      const baseProduct = createdData || {
        id: Date.now(),
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
        product_video_links: form.product_video_links || [],
        seller_name: user?.sellerName || user?.seller_name,
        project: user?.project,
        media_urls: previewUrls,
      };

      const newProduct = normalizeLinks({ ...baseProduct, status: 'draft' });
      setSubmittedProducts(prev => [newProduct, ...prev]);
      closeModal();
      showToast('success', 'Đã lưu sản phẩm!', 'Sản phẩm đã được thêm vào danh sách. Nhấn Submit để gửi cho Admin.');
    } catch (err) {
      showToast('error', 'Lỗi tạo sản phẩm!', err.response?.data?.message || err.message || 'Không thể tạo sản phẩm');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async e => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', 'Thiếu thông tin', 'Vui lòng điền đầy đủ tất cả các trường bắt buộc');
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
      product_video_links: [...(form.product_video_links || [])],
    };
    const savedProductId = editingProduct.id;

    setSubmitting(true);
    const data = new FormData();
    ['product_type', 'other_specs', 'material', 'print_area', 'good_review', 'bad_review', 'packaging_links', 'other_packaging', 'production_time', 'shipping_time', 'total_cost']
      .forEach(k => { if (form[k]) data.append(k, form[k]); });

    if (form.product_type_links && form.product_type_links.length > 0) {
      data.append('product_type_links', JSON.stringify(form.product_type_links));
    }
    if (form.product_video_links && form.product_video_links.length > 0) {
      data.append('product_video_links', JSON.stringify(form.product_video_links));
    }

    form.mediaFiles.forEach(file => { data.append('media[]', file); });

    try {
      await productApi.update(savedProductId, data);
      // Chỉ lưu chỉnh sửa — KHÔNG tự gửi Admin ở đây, phải bấm "Submit" riêng mới gửi.
      // Backend cũng luôn set lại status='draft' sau khi Seller sửa (kể cả khi sửa từ rejected),
      // nên đồng bộ local state theo đúng trạng thái đó.
      setSubmittedProducts(prev => prev.map(p =>
        p.id !== savedProductId ? p : { ...p, ...savedFormData, status: 'draft', rejection_reason: null, reason: null, reviewed_by: null, reviewed_at: null }
      ));
      closeModal();
      showToast('success', 'Thành công!', 'Đã lưu chỉnh sửa. Nhấn Submit để gửi cho Admin.');
    } catch (err) {
      showToast('error', 'Lỗi cập nhật!', err.response?.data?.message || err.message);
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
      showToast('error', 'Lỗi xóa!', err.response?.data?.message || err.message);
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
      showToast('error', 'Lỗi gửi!', err.response?.data?.message || err.message);
    } finally { setProcessingId(null); }
  };

  const openExportModal = () => {
    if (submittedProducts.length === 0) {
      showToast('error', '⚠️ Không có dữ liệu', 'Chưa có sản phẩm nào để xuất');
      return;
    }
    if (selectedIds.size === 0) {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
    setShowExportModal(true);
  };

  const confirmExport = async () => {
    const toExport = filteredProducts.filter(p => selectedIds.has(p.id));
    if (toExport.length === 0) {
      showToast('error', '⚠️ Chưa chọn sản phẩm', 'Vui lòng chọn ít nhất 1 sản phẩm để xuất');
      return;
    }
    setShowExportModal(false);
    setExporting(true);
    try {
      const today = vnDateStamp();
      await exportProductsToExcel(toExport, productVendors, `seller-products-${today}.xlsx`);
      showToast('success', 'Xuất Excel thành công!', `Đã xuất ${toExport.length} sản phẩm`);
      setSelectedIds(new Set());
    } catch (err) {
      showToast('error', 'Lỗi xuất Excel', err.message || 'Không thể xuất file');
    } finally {
      setExporting(false);
    }
  };

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
  const hasActionableProducts = submittedProducts.some(p => {
    const s = getStatus(p);
    return s === 'draft' || s === 'reject';
  });
  const renderVendorCell = (p) => {
    // Ưu tiên assigned_vendors từ API, fallback về localStorage
    let av = p.assigned_vendors;
    if (typeof av === 'string') { try { av = JSON.parse(av); } catch { av = []; } }
    const vendors = (Array.isArray(av) && av.length ? av : null) || productVendors[p.id] || [];
    const names = Array.from(new Set(vendors.map(v => (v.name || v.vendor_name || v['Vendor Name'] || '').toString().trim()).filter(Boolean)));
    if (names.length === 0) return <span style={{ color: HC.muted2, fontSize: 11, fontStyle: 'italic' }}>Chưa gán</span>;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {names.map((name, idx) => (
          <span key={idx} style={{ padding: '3px 9px', borderRadius: 999, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{name}</span>
        ))}
      </div>
    );
  };

  if (loading) return <Spinner />;

  const statusMeta = {
    draft:    { label: 'Draft',    bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', border: '#e2e8f0' },
    pending:  { label: 'Pending',  bg: '#fefce8', color: '#854d0e', dot: '#eab308', border: '#fde68a' },
    approved: { label: 'Approved', bg: '#f0fdf4', color: '#166534', dot: '#16a34a', border: '#bbf7d0' },
    reject:   { label: 'Rejected', bg: '#fef2f2', color: '#991b1b', dot: '#dc2626', border: '#fecaca' },
  };

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>
      {/* ── Toast ── */}
      <AppToast toast={toast} onClose={() => setToast(null)} />

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <p style={{ fontSize: 13, color: HC.ink2, margin: 0, fontWeight: 700 }}>Tổng cộng: {submittedProducts.length} sản phẩm đã tạo</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={openExportModal}
            disabled={exporting || submittedProducts.length === 0}
            style={{
              padding: '8px 16px', borderRadius: 10,
              background: exporting ? HC.muted2 : 'linear-gradient(135deg,#16a34a,#15803d)',
              color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 800,
              cursor: exporting || submittedProducts.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 3px 10px rgba(22,163,74,0.28)',
              opacity: submittedProducts.length === 0 ? 0.55 : 1,
              transition: 'transform 0.15s,box-shadow 0.15s',
            }}
            onMouseEnter={e => { if (!exporting && submittedProducts.length > 0) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(22,163,74,0.4)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(22,163,74,0.3)'; }}
          >
            <span style={{ fontSize: 15 }}>{exporting ? '⟳' : '↓'}</span>
            {exporting ? 'Đang xuất...' : selectedIds.size > 0 ? `Export Excel (${selectedIds.size})` : 'Export Excel'}
          </button>
          {!isMobile && (
            <button
              onClick={openCreateModal}
              style={{
                padding: '8px 16px', borderRadius: 10,
                background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
                color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: '0 3px 10px rgba(245,166,35,0.35)',
                transition: 'transform 0.15s,box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='0 6px 20px rgba(245,166,35,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 4px 14px rgba(245,166,35,0.4)'; }}
            >
              <PlusOutlined style={{ fontSize: 14 }} /> Request sản phẩm mới
            </button>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {apiError && (
        <div style={{ marginBottom: 16, padding: '12px 18px', borderRadius: 12, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>⚠️</span> {apiError}
          <button onClick={loadProducts} style={{ marginLeft: 8, padding: '4px 14px', borderRadius: 8, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, padding: '10px 14px', background: '#fff', borderRadius: 14, border: `1.5px solid ${HC.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <SearchOutlined style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: HC.muted, fontSize: 14, pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Tìm loại sản phẩm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inp, paddingLeft: 38, borderRadius: 10, border: `1.5px solid ${HC.border}`, transition: 'border-color 0.15s, box-shadow 0.15s' }}
            onFocus={e => { e.target.style.borderColor = HC.orange; e.target.style.boxShadow = `0 0 0 3px ${HC.orange}22`; }}
            onBlur={e => { e.target.style.borderColor = HC.border; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        {isMobile ? (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', width: '100%', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
            {[
              { v: '', label: 'Tất cả' },
              { v: 'pending', label: 'Pending' },
              { v: 'approved', label: 'Approved' },
              { v: 'reject', label: 'Rejected' },
            ].map(opt => {
              const active = filterStatus === opt.v;
              return (
                <button
                  key={opt.v || 'all'}
                  onClick={() => setFilterStatus(opt.v)}
                  style={{
                    flex: '0 0 auto', padding: '8px 16px', borderRadius: 999,
                    border: `1.5px solid ${active ? HC.orange : HC.border}`,
                    background: active ? HC.orange : '#fff',
                    color: active ? '#fff' : HC.ink2,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    minHeight: 44,
                  }}
                >{opt.label}</button>
              );
            })}
          </div>
        ) : (
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ flex: '0 0 180px', padding: '9px 14px', borderRadius: 10, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface2, fontWeight: 600, color: HC.ink2, cursor: 'pointer' }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Pending — Chờ duyệt</option>
            <option value="approved">Approved — Đã duyệt</option>
            <option value="reject">Rejected — Từ chối</option>
          </select>
        )}
        {hasFilter && (
          <button
            onClick={() => { setSearch(''); setFilterStatus(''); }}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >✕ Xóa bộ lọc</button>
        )}
        <div style={{ marginLeft: isMobile ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: HC.muted, fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: HC.orange, display: 'inline-block' }} />
          {filteredProducts.length} / {submittedProducts.length} sản phẩm
        </div>
      </div>

      {/* ── Table / Card List ── */}
      {filteredProducts.length === 0 ? (
        <EmptyState msg={submittedProducts.length === 0 ? 'Chưa có sản phẩm nào. Hãy tạo request đầu tiên!' : 'Không tìm thấy kết quả phù hợp'} />
      ) : isMobile ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pagedProducts.map((p, i) => {
              const mediaUrls = getMediaUrls(p);
              const status = getStatus(p);
              const isDraft = status === 'draft';
              const isRejected = status === 'reject';
              const sMeta = statusMeta[status] || statusMeta.draft;
              const dt = fmtDateTime(p.created_at);
              const reason = p.rejection_reason || p.reason;
              return (
                <div
                  key={p.id || i}
                  onClick={() => handleViewProduct(p)}
                  style={{
                    background: isRejected ? '#fff8f8' : '#fff',
                    border: `1.5px solid ${isRejected ? '#fecaca' : HC.border}`,
                    borderRadius: 16, padding: 14, cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12 }}>
                    <ThumbnailCell src={mediaUrls[0]} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 800, color: HC.ink, fontSize: 14, lineHeight: 1.3 }}>{p.product_type || '—'}</div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                          padding: '3px 9px', borderRadius: 999,
                          background: sMeta.bg, border: `1px solid ${sMeta.border}`, color: sMeta.color,
                          fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sMeta.dot, display: 'inline-block' }} />
                          {sMeta.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ngày tạo</div>
                          <div style={{ fontSize: 12, color: HC.ink2, fontWeight: 700 }}>{dt ? dt.date : '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</div>
                          <div style={{ fontSize: 12, color: HC.ink2, fontWeight: 700 }}>{p.deadline_date ? fmtDate(p.deadline_date) : '—'}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>{renderVendorCell(p)}</div>
                    </div>
                  </div>

                  {isRejected && reason && (
                    <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: HC.danger, fontWeight: 600, lineHeight: 1.4 }}>
                      {reason}
                    </div>
                  )}

                  {(isDraft || isRejected) && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleSendToAdmin(p.id)}
                        disabled={processingId === p.id}
                        style={{ flex: 1, minHeight: 44, borderRadius: 10, border: '1.5px solid #bbf7d0', background: processingId === p.id ? '#d1fae5' : '#ecfdf5', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      >
                        <SendOutlined style={{ fontSize: 12 }} />
                        {processingId === p.id ? '...' : 'Submit'}
                      </button>
                      <button
                        onClick={() => openEditModal(p)}
                        style={{ flex: 1, minHeight: 44, borderRadius: 10, border: `1.5px solid ${HC.orangeMid}`, background: HC.orangeLight, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: HC.orangeDark, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      >
                        <EditOutlined style={{ fontSize: 12 }} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={processingId === p.id}
                        style={{ flex: 1, minHeight: 44, borderRadius: 10, border: '1.5px solid #fecaca', background: processingId === p.id ? '#fee2e2' : '#fff5f5', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, color: HC.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      >
                        <DeleteOutlined style={{ fontSize: 12 }} />
                        {processingId === p.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            onPageChange={setCurrentPage}
            itemsPerPage={20}
          />
        </>
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 16, border: `1.5px solid ${HC.border}`, boxShadow: '0 2px 16px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff' }}>
              <thead>
                <tr style={{ background: '#fafafa' }}>
                  {[
                    { label: 'STT',              w: 48 },
                    { label: 'Product Type',     w: 180 },
                    { label: 'Ảnh',              w: 90 },
                    { label: 'Ngày request',     w: 130 },
                    { label: 'Deadline',         w: 110 },
                    { label: 'Status',           w: 120 },
                    { label: 'Nhân sự request',  w: 170 },
                    { label: 'Vendor',           w: 150 },
                    ...(hasActionableProducts ? [{ label: 'Actions', w: 180 }] : []),
                  ].map(h => (
                    <th key={h.label} style={{
                      textAlign: 'left', padding: '14px 18px',
                      color: '#6b7280', fontWeight: 700,
                      borderBottom: `1.5px solid #e5e7eb`,
                      fontSize: 10,
                      letterSpacing: '0.09em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      width: h.w,
                    }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((p, i) => {
                  const mediaUrls = getMediaUrls(p);
                  const status = getStatus(p);
                  const isDraft = status === 'draft';
                  const isRejected = status === 'reject';
                  const isApproved = status === 'approved';
                  const sMeta = statusMeta[status] || statusMeta.draft;
                  const dt = fmtDateTime(p.created_at);
                  const rowBg = selectedIds.has(p.id) ? '#f0fdf4'
                    : isRejected ? '#fff8f8'
                    : isApproved ? '#f9fffe'
                    : '#fff';
                  return (
                    <tr
                      key={p.id || i}
                      onClick={() => handleViewProduct(p)}
                      style={{ background: rowBg, transition: 'background 0.12s', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = rowBg}
                    >
                      {/* # */}
                      <td style={{ padding: '22px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, background: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 11 }}>
                          {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                        </span>
                      </td>

                      {/* Product Type */}
                      <td style={{ padding: '22px 18px', borderBottom: '1px solid #e5e7eb', maxWidth: 200 }}>
                        <div style={{ fontWeight: 700, color: HC.ink, fontSize: 13, lineHeight: 1.4 }}>{p.product_type || '—'}</div>
                      </td>

                      {/* Thumbnail */}
                      <td style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        <ThumbnailCell src={mediaUrls[0]} />
                      </td>

                      {/* Date Request */}
                      <td style={{ padding: '22px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        {dt ? (
                          <div>
                            <div style={{ fontWeight: 700, color: HC.ink2, fontSize: 12 }}>{dt.date}</div>
                            <div style={{ fontSize: 11, color: HC.muted, marginTop: 2, fontWeight: 600 }}>
                              {dt.time}
                            </div>
                          </div>
                        ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                      </td>

                      {/* Deadline */}
                      <td style={{ padding: '22px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        {p.deadline_date ? (
                          <div style={{ fontSize: 12, fontWeight: 700, color: HC.ink2 }}>{fmtDate(p.deadline_date)}</div>
                        ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '22px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 11px', borderRadius: 999,
                          background: sMeta.bg,
                          border: `1px solid ${sMeta.border}`,
                          color: sMeta.color,
                          fontWeight: 700, fontSize: 11, letterSpacing: '0.02em',
                          whiteSpace: 'nowrap',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sMeta.dot, display: 'inline-block', flexShrink: 0 }} />
                          {sMeta.label}
                        </span>
                      </td>

                      {/* Nhân sự request */}
                      <td style={{ padding: '22px 18px', borderBottom: '1px solid #e5e7eb', maxWidth: 180 }}>
                        {p.seller_name
                          ? <div style={{ fontSize: 12, color: HC.ink2, fontWeight: 700 }}>{p.seller_name}</div>
                          : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                      </td>

                      {/* Vendor */}
                      <td style={{ padding: '22px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        {renderVendorCell(p)}
                      </td>

                      {/* Actions */}
                      {hasActionableProducts && (
                      <td style={{ padding: '19px 18px', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}>
                          {(isDraft || isRejected) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSendToAdmin(p.id); }}
                              disabled={processingId === p.id}
                              style={{ padding: '6px 13px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: processingId === p.id ? '#d1fae5' : '#ecfdf5', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 11, fontWeight: 700, color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                              onMouseEnter={e => { if (processingId !== p.id) { e.currentTarget.style.background = '#d1fae5'; e.currentTarget.style.borderColor = '#6ee7b7'; } }}
                              onMouseLeave={e => { e.currentTarget.style.background = processingId === p.id ? '#d1fae5' : '#ecfdf5'; e.currentTarget.style.borderColor = '#bbf7d0'; }}
                            >
                              <SendOutlined style={{ fontSize: 11 }} />
                              {processingId === p.id ? 'Sending...' : 'Submit'}
                            </button>
                          )}

                          {(isDraft || isRejected) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                              style={{ padding: '6px 13px', borderRadius: 8, border: `1.5px solid ${HC.orangeMid}`, background: HC.orangeLight, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: HC.orangeDark, display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                              onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                              onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                            >
                              <EditOutlined style={{ fontSize: 11 }} />
                              Edit
                            </button>
                          )}

                          {(isDraft || isRejected) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                              disabled={processingId === p.id}
                              style={{ padding: '6px 13px', borderRadius: 8, border: '1.5px solid #fecaca', background: processingId === p.id ? '#fee2e2' : '#fff5f5', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 11, fontWeight: 700, color: HC.danger, display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                              onMouseEnter={e => { if (processingId !== p.id) { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#f87171'; } }}
                              onMouseLeave={e => { e.currentTarget.style.background = processingId === p.id ? '#fee2e2' : '#fff5f5'; e.currentTarget.style.borderColor = '#fecaca'; }}
                            >
                              <DeleteOutlined style={{ fontSize: 11 }} />
                              {processingId === p.id ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                      )}
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

      {/* FAB — tạo request mới (mobile) */}
      {isMobile && (
        <button
          onClick={openCreateModal}
          aria-label="Request sản phẩm mới"
          style={{
            position: 'fixed', right: 18, bottom: 18, width: 58, height: 58, borderRadius: '50%',
            background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
            color: '#fff', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(245,166,35,0.5)', zIndex: 150,
          }}
        >
          <PlusOutlined style={{ fontSize: 22 }} />
        </button>
      )}

      {/* MODAL TẠO/SỬA SẢN PHẨM */}
      {showFormModal && (
        <div onClick={isMobile ? undefined : closeModal} style={{ position: 'fixed', inset: 0, background: isMobile ? HC.surface : 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: isMobile ? 'stretch' : 'center', zIndex: 1000, backdropFilter: isMobile ? 'none' : 'blur(2px)', padding: isMobile ? 0 : 16 }}>
          <div onClick={e => e.stopPropagation()} style={isMobile
            ? { width: '100%', height: '100%', overflowY: 'auto', background: HC.surface }
            : { width: '100%', maxWidth: 900, maxHeight: '85vh', overflowY: 'auto', background: HC.surface, borderRadius: 20, boxShadow: HC.shadowStrong, border: `1.5px solid ${HC.border}` }}>

            {/* Modal Header */}
            <div style={{ padding: '16px 24px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, borderRadius: isMobile ? 0 : '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: isMobile ? 'sticky' : 'static', top: 0, zIndex: 2 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Inter',sans-serif" }}>
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
                  <AutoGrowTextarea
                    placeholder="Câu trả lời của bạn"
                    value={form.product_type}
                    onChange={fld('product_type')}
                    style={{ borderColor: formErrors.product_type ? HC.danger : HC.border }}
                  />
                </Field>
              </div>

              {/* 1.1 Hình ảnh sản phẩm — link + upload gộp 1 mục */}
              <div style={{ marginBottom: 16 }}>
                <Field label="1.1 Link hình ảnh (Nhiều link, sau mỗi link bấm enter)" required error={formErrors.product_type_links}>
                  {/* Hidden file input — disabled */}

                  {/* Input row — link + 2 buttons */}
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
                        padding: '9px 16px', borderRadius: 9,
                        background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
                        color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', whiteSpace: 'nowrap'
                      }}
                    >
                      + Thêm link
                    </button>
                  </div>

                  {/* Live preview khi đang nhập link */}
                  {tempLink && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: `2px dashed ${HC.orangeMid}`, flexShrink: 0 }}>
                        <LinkPreviewImg src={tempLink} />
                      </div>
                      <span style={{ fontSize: 11, color: HC.muted, fontStyle: 'italic' }}>Preview — nhấn Enter hoặc "+ Thêm link" để xác nhận</span>
                    </div>
                  )}

                  {/* Thumbnail grid — links đã thêm */}
                  {form.product_type_links.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {form.product_type_links.map((link, idx) => (
                        <div key={idx} style={{ position: 'relative', width: 90, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${HC.orangeMid}`, background: HC.surface, flexShrink: 0 }}>
                          <LinkPreviewImg src={link} />
                          <button
                            type="button"
                            onClick={() => removeLink(idx)}
                            style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >✕</button>
                          <div
                            onClick={() => openLink(link)}
                            style={{ padding: '4px 6px', background: HC.orangeLight, fontSize: 9, color: HC.orangeDark, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                            title={link}
                          >
                            🔗 {link.length > 18 ? link.substring(0, 18) + '…' : link}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}


                  {formErrors.product_type_links && (
                    <span style={{ color: HC.danger, fontSize: 10, marginTop: 2 }}>⚠ {formErrors.product_type_links}</span>
                  )}
                </Field>
              </div>

              {/* 1.2 Link video sản phẩm */}
              <div style={{ marginBottom: 16 }}>
                <Field label="1.2 Link video sản phẩm (YouTube, Google Drive, v.v.)">
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="url"
                      placeholder="Câu trả lời của bạn"
                      value={tempVideoLink}
                      onChange={e => setTempVideoLink(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addVideoLink()}
                      style={{ ...inp, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={addVideoLink}
                      style={{
                        padding: '9px 16px', borderRadius: 9,
                        background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
                        color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', whiteSpace: 'nowrap'
                      }}
                    >
                      + Thêm link
                    </button>
                  </div>
                  {(form.product_video_links || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(form.product_video_links || []).map((link, idx) => (
                        <div key={idx} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px', borderRadius: 20,
                          background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`,
                          fontSize: 11, fontWeight: 700, color: HC.orangeDark, maxWidth: 280,
                        }}>
                          <span
                            onClick={() => openLink(link)}
                            style={{ cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={link}
                          >
                            🎬 {link.length > 32 ? link.substring(0, 32) + '…' : link}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeVideoLink(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: HC.orangeDark, fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="1.4 Thời gian sản xuất mong muốn (Ví dụ: 1-3)" required error={formErrors.production_time}>
                  <AutoGrowTextarea placeholder="Câu trả lời của bạn" value={form.production_time} onChange={fld('production_time')} style={{ borderColor: formErrors.production_time ? HC.danger : HC.border }} />
                </Field>
                <Field label="1.5 Thời gian ship mong muốn (Ví dụ: 3-5)" required error={formErrors.shipping_time}>
                  <AutoGrowTextarea placeholder="Câu trả lời của bạn" value={form.shipping_time} onChange={fld('shipping_time')} style={{ borderColor: formErrors.shipping_time ? HC.danger : HC.border }} />
                </Field>
                <Field label="1.6 Total Cost (Bao gồm Base và Shipping cost, Ví dụ: 100-150)" required error={formErrors.total_cost}>
                  <AutoGrowTextarea placeholder="Câu trả lời của bạn" value={form.total_cost} onChange={fld('total_cost')} style={{ borderColor: formErrors.total_cost ? HC.danger : HC.border }} />
                </Field>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: HC.ink, marginBottom: 8 }}>2. Đặc tính kỹ thuật (Mô tả về đặc tính Product Type)</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <Field label="2.1 Chất liệu (Ví dụ: 100% cotton)" required error={formErrors.material}>
                    <AutoGrowTextarea placeholder="Câu trả lời của bạn" value={form.material} onChange={fld('material')} style={{ borderColor: formErrors.material ? HC.danger : HC.border }} />
                  </Field>
                  {/* Nội dung ở đây hay dài hàng chục dòng (spec, evidence...) — dùng
                      textarea cố định chiều cao + cuộn như 2.3/2.4/2.5, thay vì
                      AutoGrowTextarea (cao theo nội dung, đẩy form dài vô tận). */}
                  <Field label="2.2 Vùng In/Thiết kế (Ví dụ: 2 vùng in trước và sau)" required error={formErrors.print_area}>
                    <textarea
                      placeholder="Câu trả lời của bạn"
                      value={form.print_area}
                      onChange={fld('print_area')}
                      style={{ ...inp, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, borderColor: formErrors.print_area ? HC.danger : HC.border }}
                    />
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

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                  <Field label="3.1 Packaging (Ví dụ: Mỗi sản phẩm được đóng gói hộp xốp)" required error={formErrors.packaging_links}>
                    <textarea
                      placeholder="Câu trả lời của bạn"
                      value={form.packaging_links}
                      onChange={fld('packaging_links')}
                      style={{ ...inp, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, borderColor: formErrors.packaging_links ? HC.danger : HC.border }}
                    />
                  </Field>
                  <Field label="3.2 Other Packaging (Phụ kiện đi kèm - Ví dụ: Thank you card)" required error={formErrors.other_packaging}>
                    <textarea
                      placeholder="Câu trả lời của bạn"
                      value={form.other_packaging}
                      onChange={fld('other_packaging')}
                      style={{ ...inp, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, borderColor: formErrors.other_packaging ? HC.danger : HC.border }}
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
                  Cancel
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
                  {submitting ? '⟳ Đang xử lý...' : isEditing ? '✓ Confirm' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewProduct && <ProductViewerModal product={viewProduct} productVendors={productVendors} onClose={() => setViewProduct(null)} getStatus={getStatus} onViewVendorLibrary={onViewVendorLibrary} />}

      {/* ── Export Confirm Modal ── */}
      {showExportModal && (() => {
        const toExport = filteredProducts.filter(p => selectedIds.has(p.id));
        const exportStatusMeta = {
          draft:    { label: 'Draft',    bg: '#f3f4f6', color: '#6b7280' },
          pending:  { label: 'Pending',  bg: '#fffbeb', color: '#92400e' },
          approved: { label: 'Approved', bg: '#ecfdf5', color: '#065f46' },
          reject:   { label: 'Rejected', bg: '#fef2f2', color: '#991b1b' },
        };
        return (
          <div
            onClick={() => setShowExportModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, backdropFilter: 'blur(3px)', padding: 16 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.22)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', animation: 'fadeIn 0.2s ease' }}
            >
              {/* Header */}
              <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>↓</div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Inter',sans-serif" }}>Xác nhận xuất Excel</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
                    {toExport.length} sản phẩm sẽ được xuất ra file Excel
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >✕</button>
              </div>

              {/* Summary bar */}
              <div style={{ padding: '12px 24px', background: '#f0fdf4', borderBottom: `1px solid #bbf7d0`, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                    Đã chọn <strong>{toExport.length}</strong> / {filteredProducts.length} sản phẩm
                  </span>
                </div>
                <button
                  onClick={() => setSelectedIds(new Set(filteredProducts.map(p => p.id)))}
                  style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'transparent', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                >Chọn tất cả</button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  style={{ fontSize: 11, fontWeight: 700, color: HC.danger, background: 'transparent', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
                >Bỏ chọn</button>
              </div>

              {/* Product list */}
              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: HC.muted, fontSize: 13 }}>Không có sản phẩm nào</div>
                ) : filteredProducts.map((p, idx) => {
                  const st = getStatus(p);
                  const sm = exportStatusMeta[st] || exportStatusMeta.draft;
                  const isChecked = selectedIds.has(p.id);
                  return (
                    <div
                      key={p.id || idx}
                      onClick={() => setSelectedIds(prev => {
                        const next = new Set(prev);
                        next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                        return next;
                      })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderRadius: 10, cursor: 'pointer', transition: 'background 0.12s',
                        background: isChecked ? '#f0fdf4' : '#fafafa',
                        border: `1.5px solid ${isChecked ? '#bbf7d0' : HC.border}`,
                      }}
                      onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isChecked ? '#f0fdf4' : '#fafafa'; }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        border: `2px solid ${isChecked ? '#16a34a' : HC.border}`,
                        background: isChecked ? '#16a34a' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {isChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.product_type || `Sản phẩm #${idx + 1}`}
                        </div>
                      </div>
                      {/* Status */}
                      <span style={{ padding: '3px 10px', borderRadius: 999, background: sm.bg, color: sm.color, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {sm.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: `1.5px solid ${HC.border}`, display: 'flex', gap: 12, justifyContent: 'flex-end', background: HC.surface2 }}>
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{ padding: '10px 22px', borderRadius: 10, background: HC.cream, border: `1.5px solid ${HC.border}`, color: HC.brown, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >Huỷ</button>
                <button
                  onClick={confirmExport}
                  disabled={toExport.length === 0}
                  style={{
                    padding: '10px 28px', borderRadius: 10,
                    background: toExport.length === 0 ? HC.muted2 : 'linear-gradient(135deg,#16a34a,#15803d)',
                    color: '#fff', border: 'none', fontSize: 13, fontWeight: 800,
                    cursor: toExport.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    boxShadow: toExport.length > 0 ? '0 4px 14px rgba(22,163,74,0.35)' : 'none',
                    opacity: toExport.length === 0 ? 0.6 : 1,
                  }}
                >
                  <span>↓</span> Xuất {toExport.length} sản phẩm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

