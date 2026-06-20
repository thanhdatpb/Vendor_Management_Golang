import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  BarChartOutlined, FolderOpenOutlined, HourglassOutlined,
  CheckCircleOutlined, CloseCircleOutlined, CheckCircleFilled,
  WarningFilled, CloseCircleFilled, AimOutlined, FireOutlined,
  FormatPainterOutlined, SmileOutlined, GlobalOutlined, RocketOutlined,
  ClockCircleOutlined, CheckOutlined, EyeOutlined, CloseOutlined, LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { HC, API_BASE_URL, ITEMS_PER_PAGE } from '../constants';
import { normalizeList, normalizeProduct, getMediaUrls, fmtDate } from '../utils';
import { playNotificationBeep } from '../audio';
import { productApi } from '../../../services/api';
import { Spinner, Table, Badge, MediaGallery, Pagination } from '../ui';
import AppToast from '../../shared/AppToast';
import FormHistoryModal from '../modals/FormHistoryModal';
import ProductViewerModal from '../modals/ProductViewerModal';
import RejectModal from '../modals/RejectModal';

// ── Mini donut / ring progress ─────────────────────────────
function RingProgress({ percent, color, size = 46 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0E4CC" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 800, fill: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>
        {percent}%
      </text>
    </svg>
  );
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, icon, color, onClick, subLabel }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        borderTop: `1.5px solid ${hovered ? color : '#F0E4CC'}`,
        borderRight: `1.5px solid ${hovered ? color : '#F0E4CC'}`,
        borderBottom: `1.5px solid ${hovered ? color : '#F0E4CC'}`,
        borderLeft: `4px solid ${color}`,
        boxShadow: hovered ? `0 8px 24px ${color}22` : '0 2px 10px rgba(0,0,0,0.06)',
        padding: '20px 20px 20px 18px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9C7A50', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: "'Nunito',sans-serif" }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#1A0F00', fontFamily: "'Nunito',sans-serif", lineHeight: 1 }}>{value}</div>
          {subLabel && <div style={{ fontSize: 11, color: '#B8956A', marginTop: 10, fontWeight: 600 }}>{subLabel}</div>}
        </div>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: color + '18', color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
      </div>
    </div>
  );
}

// ── Project Card ───────────────────────────────────────────
const PROJECT_META = {
  'Creative Project': { icon: <FormatPainterOutlined />, color: '#F5A623' },
  'Happy Project':    { icon: <SmileOutlined />, color: '#10B981' },
  'Global Project':   { icon: <GlobalOutlined />, color: '#3B82F6' },
  'Pilot Project':    { icon: <RocketOutlined />, color: '#A855F7' },
};

function ProjectCard({ project, stats, onClick, onStatusClick }) {
  const [hovered, setHovered] = useState(false);
  const meta = PROJECT_META[project] || { icon: <FolderOpenOutlined />, color: '#6B7280' };
  const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  const pending = stats.total - stats.approved - stats.rejected;

  const rowStyle = { 
    cursor: 'pointer', 
    padding: '10px 12px', 
    borderRadius: 8, 
    border: '1px solid #F3F4F6',
    transition: 'all 0.2s', 
    background: '#FAFAFA' 
  };
  const onRowHover = (e, isHover) => { 
    e.currentTarget.style.background = isHover ? '#F0F9FF' : '#FAFAFA'; 
    e.currentTarget.style.borderColor = isHover ? '#BAE6FD' : '#F3F4F6';
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        border: `1.5px solid ${hovered ? meta.color : '#F0E4CC'}`,
        boxShadow: hovered ? `0 8px 24px ${meta.color}15` : '0 2px 8px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div onClick={onClick} style={{ padding: '16px 20px', borderBottom: '1.5px solid #F0E4CC', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.2s', cursor: 'pointer' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: meta.color + '15', color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#1A0F00', fontFamily: "'Nunito',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project}</div>
          <div style={{ fontSize: 11, color: '#9C7A50', fontWeight: 600, marginTop: 2 }}>{stats.total} form · {approvalRate}% duyệt</div>
        </div>
        <RingProgress percent={approvalRate} color={approvalRate >= 50 ? '#10B981' : '#F59E0B'} size={48} />
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div 
          onClick={() => onStatusClick('approved')} 
          style={rowStyle}
          onMouseEnter={e => onRowHover(e, true)}
          onMouseLeave={e => onRowHover(e, false)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Đã duyệt</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: "'Nunito',sans-serif" }}>{stats.approved}</span>
          </div>
          <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%`, height: '100%', background: '#10B981', borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
        </div>
        
        <div 
          onClick={() => onStatusClick('pending')} 
          style={rowStyle}
          onMouseEnter={e => onRowHover(e, true)}
          onMouseLeave={e => onRowHover(e, false)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Chờ duyệt</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: "'Nunito',sans-serif" }}>{pending}</span>
          </div>
          <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${stats.total > 0 ? (pending / stats.total) * 100 : 0}%`, height: '100%', background: '#F59E0B', borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
        </div>
        
        <div 
          onClick={() => onStatusClick('rejected')} 
          style={rowStyle}
          onMouseEnter={e => onRowHover(e, true)}
          onMouseLeave={e => onRowHover(e, false)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Từ chối</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: "'Nunito',sans-serif" }}>{stats.rejected}</span>
          </div>
          <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%`, height: '100%', background: '#EF4444', borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function OverviewSection({ externalViewProduct, setExternalViewProduct }) {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterType, setModalFilterType] = useState('');
  const [modalFilterValue, setModalFilterValue] = useState('');
  const [modalInitialStatus, setModalInitialStatus] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');
  const [formStats, setFormStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [projectStats, setProjectStats] = useState({
    'Happy Project':    { approved: 0, rejected: 0, total: 0 },
    'Creative Project': { approved: 0, rejected: 0, total: 0 },
    'Global Project':   { approved: 0, rejected: 0, total: 0 },
    'Pilot Project':    { approved: 0, rejected: 0, total: 0 },
  });

  const [pendingProducts, setPendingProducts] = useState([]);
  const [viewProduct, setViewProduct] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, productId: null, reason: '' });
  const pendingCountRef = useRef(0);
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [sellerNamesMap, setSellerNamesMap] = useState({});
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [pendingPage, setPendingPage] = useState(1);
  const notifiedProductIds = useRef(new Set());
  const LS_REJECTED_CACHE = 'ADMIN_REJECTED_CACHE_V1';
  const LS_SELLER_PRODUCTS = 'SELLER_PRODUCTS_V1';

  useEffect(() => {
    const loadSellerNames = () => {
      try {
        const saved = localStorage.getItem(LS_SELLER_PRODUCTS);
        if (saved) {
          setSellerNamesMap(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Lỗi load seller names:', e);
      }
    };
    loadSellerNames();
    window.addEventListener('storage', loadSellerNames);
    return () => window.removeEventListener('storage', loadSellerNames);
  }, []);

  const getSellerName = useCallback((product) => {
    if (product.seller_name) return product.seller_name;
    if (product.sellerName) return product.sellerName;
    if (product.user_name) return product.user_name;
    if (product.userName) return product.userName;
    const fromLocal = sellerNamesMap[product.id];
    if (fromLocal) {
      return fromLocal.seller_name || fromLocal.sellerName || '—';
    }
    return '—';
  }, [sellerNamesMap]);

  useEffect(() => {
    if (externalViewProduct) {
      setViewProduct(externalViewProduct);
      if (setExternalViewProduct) {
        setExternalViewProduct(null);
      }
    }
  }, [externalViewProduct, setExternalViewProduct]);

  const computeStats = useCallback((products) => {
    const pending  = products.filter(p => p.status === 'pending').length;
    const approved = products.filter(p => p.status === 'approved').length;
    const rejected = products.filter(p => p.status === 'rejected' || p.status === 'reject').length;
    setFormStats({ pending, approved, rejected, total: products.length });
    const projects = ['Happy Project', 'Creative Project', 'Global Project', 'Pilot Project'];
    const ps = {};
    projects.forEach(proj => {
      const pp = products.filter(p => {
        const dbProj = (p.project || '').toLowerCase().trim();
        const uiProj = proj.toLowerCase().replace(' project', '');
        return dbProj === uiProj || dbProj === proj.toLowerCase();
      });
      ps[proj] = {
        approved: pp.filter(p => p.status === 'approved').length,
        rejected: pp.filter(p => p.status === 'rejected' || p.status === 'reject').length,
        total: pp.length,
      };
    });
    setProjectStats(ps);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const allRes = await productApi.list();
      const all = normalizeList(allRes).map(normalizeProduct);
      setAllProducts(all);
      computeStats(all);

    } catch (err) {
      console.error('❌ Lỗi tải dữ liệu:', err);
      setFormStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [computeStats]);

  const createNewFormNotification = useCallback((product) => {
    const projectName = product.project || 'Không xác định';
    const sellerName = getSellerName(product);

    return {
      id: `form_${product.id}_${Date.now()}`,
      type: 'new_form',
      icon: '📋',
      title: `Yêu cầu duyệt sản phẩm mới`,
      message: `Seller của project ${projectName} vừa gửi form request mới.`,
      product_id: product.id,
      product_type: product.product_type,
      project: projectName,
      seller_name: sellerName,
      timestamp: product.created_at || new Date().toISOString(),
      read: false,
    };
  }, [getSellerName]);

  const loadPending = useCallback(() => {
    return productApi.pendingApprovals()
      .then(r => {
        const newPending = normalizeList(r).map(normalizeProduct);
        const oldCount = pendingCountRef.current;

        setPendingProducts(newPending);

        const existingNotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
        const filteredNotifs = existingNotifs.filter(n => n.type === 'new_form');
        let hasNew = false;

        newPending.forEach(product => {
          const alreadyNotified = filteredNotifs.some(
            n => String(n.product_id) === String(product.id) && n.type === 'new_form'
          );
          if (!alreadyNotified && !notifiedProductIds.current.has(product.id)) {
            notifiedProductIds.current.add(product.id);
            const newNotification = createNewFormNotification(product);
            filteredNotifs.unshift(newNotification);
            hasNew = true;
          }
        });

        if (hasNew) {
          localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(filteredNotifs.slice(0, 100)));
          window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_A_NOTIFICATIONS' }));
          window.dispatchEvent(new CustomEvent('pendingProductsUpdated', { detail: newPending }));

          if (oldCount > 0 && newPending.length > oldCount) {
            playNotificationBeep();
          }

          if (newPending.length > oldCount) {
            const newCount = newPending.length - oldCount;
            const newestProducts = newPending.slice(0, newCount);
            const projectNames = [...new Set(newestProducts.map(p => p.project || 'Không xác định'))];
            setToast({
              type: 'new_form',
              title: 'Form mới từ Seller!',
              message: `${newCount} form mới từ Project: ${projectNames.join(', ')}`,
              duration: 5000
            });
          }
        }

        pendingCountRef.current = newPending.length;
      })
      .catch(err => {
        console.error('Lỗi load pending:', err);
        setPendingProducts([]);
      });
  }, [createNewFormNotification]);

  const handleApprove = async (product) => {
    if (processingId === product.id) return;
    setProcessingId(product.id);

    try {
      await productApi.approve(product.id, { approved: true });

      try {
        const approvedProducts = JSON.parse(localStorage.getItem('STAFF_A_APPROVED_PRODUCTS_V1') || '[]');
        const existingIndex = approvedProducts.findIndex(p => p.id === product.id);
        const updatedProduct = { ...product, status: 'approved', approved_at: new Date().toISOString() };
        if (existingIndex >= 0) {
          approvedProducts[existingIndex] = updatedProduct;
        } else {
          approvedProducts.unshift(updatedProduct);
        }
        localStorage.setItem('STAFF_A_APPROVED_PRODUCTS_V1', JSON.stringify(approvedProducts.slice(0, 100)));
      } catch (e) { }

      const cache = JSON.parse(localStorage.getItem(LS_REJECTED_CACHE) || '{}');
      if (cache[product.id]) {
        delete cache[product.id];
        localStorage.setItem(LS_REJECTED_CACHE, JSON.stringify(cache));
      }

      try {
        const staffBNotifications = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
        const newNotif = {
          id: Date.now(),
          type: 'product_approved',
          title: 'Sản phẩm đã được duyệt',
          message: `Sản phẩm "${product.product_type}" của Seller "${getSellerName(product)}" đã được Admin duyệt. Hãy vào "Products" để gán Vendor.`,
          productId: product.id,
          productType: product.product_type,
          sellerName: getSellerName(product),
          timestamp: new Date().toISOString(),
          read: false,
        };
        staffBNotifications.unshift(newNotif);
        localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(staffBNotifications.slice(0, 100)));
        window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS' }));
      } catch (e) {
        console.warn('Không thể gửi thông báo cho Staff B', e);
      }

      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
      setAllProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) {
          return prev.map(p => p.id === product.id ? { ...p, status: 'approved' } : p);
        } else {
          return [...prev, { ...product, status: 'approved' }];
        }
      });
      loadAllData(); // Refresh stats

      setToast({
        type: 'success',
        title: 'Duyệt thành công!',
        message: `Sản phẩm "${product.product_type}" đã được duyệt`,
        duration: 3000
      });
    } catch (err) {
      console.error('Lỗi duyệt:', err);
      setToast({
        type: 'error',
        title: 'Lỗi duyệt!',
        message: err.response?.data?.message || 'Không thể duyệt sản phẩm',
        duration: 4000
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.reason.trim()) {
      setToast({
        type: 'warning',
        title: 'Thiếu lý do!',
        message: 'Vui lòng nhập lý do từ chối',
        duration: 3000
      });
      return;
    }

    const product = pendingProducts.find(p => p.id === rejectModal.productId);
    if (!product) return;

    setProcessingId(rejectModal.productId);

    try {
      await productApi.approve(rejectModal.productId, {
        approved: false,
        reason: rejectModal.reason
      });

      try {
        const rejectedProducts = JSON.parse(localStorage.getItem('STAFF_A_REJECTED_PRODUCTS_V1') || '[]');
        rejectedProducts.unshift({ ...product, status: 'rejected', rejected_at: new Date().toISOString(), reason: rejectModal.reason });
        localStorage.setItem('STAFF_A_REJECTED_PRODUCTS_V1', JSON.stringify(rejectedProducts.slice(0, 100)));
      } catch (e) { }

      const cache = JSON.parse(localStorage.getItem(LS_REJECTED_CACHE) || '{}');
      cache[product.id] = { timestamp: Date.now() };
      localStorage.setItem(LS_REJECTED_CACHE, JSON.stringify(cache));

      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
      setAllProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) {
          return prev.map(p => p.id === product.id ? { ...p, status: 'rejected' } : p);
        } else {
          return [...prev, { ...product, status: 'rejected' }];
        }
      });
      loadAllData(); // Refresh stats

      setToast({
        type: 'warning',
        title: 'Đã từ chối!',
        message: `Sản phẩm "${product.product_type}" đã bị từ chối`,
        duration: 5000
      });

      setRejectModal({ open: false, productId: null, reason: '' });
    } catch (err) {
      console.error('Lỗi từ chối:', err);
      setToast({
        type: 'error',
        title: 'Lỗi từ chối!',
        message: err.response?.data?.message || 'Không thể từ chối sản phẩm',
        duration: 4000
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewProduct = useCallback(async (product) => {
    if (loadingProductId === product.id) return;
    setLoadingProductId(product.id);
    try {
      const response = await productApi.getById(product.id);
      const fullProduct = response.data?.data || response.data;
      setViewProduct(normalizeProduct(fullProduct));
    } catch (err) {
      console.error('❌ Lỗi tải chi tiết sản phẩm:', err);
      setViewProduct(normalizeProduct(product));
    } finally {
      setLoadingProductId(null);
    }
  }, [loadingProductId]);

  const handleCardClick = (type, value, label) => {
    setModalTitle(label);
    setModalFilterType(type);
    setModalFilterValue(value);
    setModalInitialStatus('all');
    setModalOpen(true);
  };

  const handleProjectStatusClick = (project, status) => {
    let statusLabel = status === 'approved' ? 'Đã Duyệt' : status === 'rejected' ? 'Từ Chối' : 'Chờ Duyệt';
    setModalTitle(`Lịch sử Form — ${project} (${statusLabel})`);
    setModalFilterType('project');
    setModalFilterValue(project);
    setModalInitialStatus(status);
    setModalOpen(true);
  };

  useEffect(() => {
    Promise.all([loadAllData(), loadPending()]);
    const interval = setInterval(() => { loadAllData(); loadPending(); }, 15000);
    return () => clearInterval(interval);
  }, [loadAllData, loadPending]);

  const TABLE_COLS = ['STT', 'Project', 'Product Type', 'Hình ảnh', 'Date Request', 'Deadline', 'Trạng thái', 'Thao tác'];

  const viewBtn = (p) => (
    <button
      onClick={() => handleViewProduct(p)}
      disabled={loadingProductId === p.id}
      className="hc-btn-secondary"
      style={{
        padding: '5px 12px',
        fontSize: 11,
        borderRadius: 7,
        opacity: loadingProductId === p.id ? 0.6 : 1,
        cursor: loadingProductId === p.id ? 'wait' : 'pointer',
        fontFamily: "'Nunito',sans-serif",
      }}
    >
      {loadingProductId === p.id
        ? <><LoadingOutlined spin style={{ fontSize: 12 }} /> Đang tải...</>
        : <><EyeOutlined /> Xem</>}
    </button>
  );

  const sHdr = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' };
  const h3S = { fontSize: 15, fontWeight: 900, color: HC.ink, margin: 0, fontFamily: "'Nunito',sans-serif" };
  const refreshBtn = fn => (
    <button
      onClick={async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try { await fn(); } finally { setIsRefreshing(false); }
      }}
      disabled={isRefreshing}
      className="hc-btn-secondary"
      style={{
        marginLeft: 'auto', padding: '5px 14px', borderRadius: 8,
        fontSize: 11, fontWeight: 800,
        cursor: isRefreshing ? 'not-allowed' : 'pointer',
        fontFamily: "'Nunito',sans-serif",
        opacity: isRefreshing ? 0.8 : 1,
      }}
    >
      <ReloadOutlined style={{ fontSize: 11, animation: isRefreshing ? 'hc-spin 0.7s linear infinite' : 'none', display: 'inline-block' }} />
      {isRefreshing ? 'Đang tải...' : 'Làm mới'}
    </button>
  );

  if (loading) return <Spinner />;

  const displayProjects = ['Happy Project', 'Creative Project', 'Global Project', 'Pilot Project'];
  const filteredProjects = activeFilter === 'all'
    ? displayProjects
    : displayProjects.filter(p => {
        const s = projectStats[p] || {};
        if (activeFilter === 'active') return s.total > 0;
        if (activeFilter === 'pending') return (s.total - s.approved - s.rejected) > 0;
        if (activeFilter === 'completed') return s.total > 0 && (s.total === s.approved + s.rejected);
        return true;
      });

  const overallRate = formStats.total > 0 ? Math.round((formStats.approved / formStats.total) * 100) : 0;

  return (
    <div style={{ fontFamily: "'Nunito Sans',sans-serif", maxWidth: 1440, margin: '0 auto' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, animation: 'fadeUp 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF8EE', border: '1.5px solid #FDE8B8', color: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}><BarChartOutlined /></div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Thống Kê Tổng Quan</div>
            <div style={{ fontSize: 12, color: '#9C7A50', fontWeight: 600, marginTop: 2 }}>Cập nhật mỗi 15 giây · {formStats.total} form tổng cộng</div>
          </div>
        </div>
        <div style={{ padding: '6px 16px', borderRadius: 20, background: overallRate >= 70 ? '#ecfdf5' : overallRate >= 40 ? '#fffbeb' : '#fef2f2', border: `1.5px solid ${overallRate >= 70 ? '#bbf7d0' : overallRate >= 40 ? '#fde68a' : '#fecaca'}`, color: overallRate >= 70 ? '#166534' : overallRate >= 40 ? '#92400e' : '#991b1b', fontSize: 12, fontWeight: 800, fontFamily: "'Nunito',sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>{overallRate >= 70 ? <CheckCircleFilled /> : overallRate >= 40 ? <WarningFilled /> : <CloseCircleFilled />}</span>
          Tỷ lệ duyệt: {overallRate}%
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 36, animation: 'fadeUp 0.45s ease' }}>
        <StatCard label="Tổng Form Request" value={formStats.total} icon={<FolderOpenOutlined />} color="#F5A623" subLabel="Tất cả trạng thái" onClick={() => handleCardClick('status', 'all', 'Tất cả Form Request')} />
        <StatCard label="Chờ Duyệt" value={formStats.pending} icon={<HourglassOutlined />} color="#F59E0B" subLabel={formStats.pending > 0 ? 'Cần xử lý ngay' : 'Không có form chờ'} onClick={() => handleCardClick('status', 'pending', 'Form Chờ Duyệt')} />
        <StatCard label="Đã Duyệt" value={formStats.approved} icon={<CheckCircleOutlined />} color="#10B981" subLabel={`${overallRate}% tỷ lệ duyệt`} onClick={() => handleCardClick('status', 'approved', 'Form Đã Duyệt')} />
        <StatCard label="Từ Chối" value={formStats.rejected} icon={<CloseCircleOutlined />} color="#EF4444" subLabel={formStats.rejected > 0 ? `${Math.round((formStats.rejected / (formStats.total || 1)) * 100)}% tổng form` : 'Không có từ chối'} onClick={() => handleCardClick('status', 'rejected', 'Form Từ Chối')} />
      </div>

      {/* ── Project section header + filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, animation: 'fadeUp 0.5s ease', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F8F9FA', border: '1.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#9C7A50' }}><AimOutlined /></div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Thống Kê Theo Project</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all',       label: 'Tất cả' },
            { id: 'active',    label: <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FireOutlined /> Có hoạt động</span> },
            { id: 'pending',   label: <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><HourglassOutlined /> Còn chờ</span> },
            { id: 'completed', label: <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckOutlined /> Hoàn tất</span> },
          ].map(f => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${activeFilter === f.id ? '#F5A623' : '#F0E4CC'}`, background: activeFilter === f.id ? '#FFF8EE' : '#fff', color: activeFilter === f.id ? '#F5A623' : '#9C7A50', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", transition: 'all 0.2s' }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── Project Cards grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, animation: 'fadeUp 0.55s ease', marginBottom: 36 }}>
        {filteredProjects.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#B8956A', fontSize: 13, fontWeight: 600, background: '#FFFBF4', borderRadius: 16, border: '1.5px dashed #F0E4CC' }}>
            Không có project nào phù hợp với bộ lọc này
          </div>
        ) : filteredProjects.map(project => (
          <ProjectCard
            key={project}
            project={project}
            stats={projectStats[project] || { approved: 0, rejected: 0, total: 0 }}
            onClick={() => handleCardClick('project', project, `Lịch sử Form — ${project}`)}
            onStatusClick={(status) => handleProjectStatusClick(project, status)}
          />
        ))}
      </div>

      {/* ── Form Chờ Duyệt (Pending Table) ── */}
      <div style={{ marginBottom: pendingProducts.length === 0 ? 16 : 32, animation: 'fadeUp 0.6s ease' }}>
        <div style={sHdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, color: '#F59E0B', display: 'flex' }}><ClockCircleOutlined /></span>
            <h3 style={h3S}>Form Chờ Duyệt Từ Seller</h3>
          </div>
          {pendingProducts.length > 0 && (
            <span style={{
              padding: '4px 14px',
              borderRadius: 999,
              background: HC.orangeLight,
              border: `1.5px solid ${HC.orangeMid}`,
              color: HC.orangeDark,
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "'Nunito',sans-serif"
            }}>
              {pendingProducts.length} form chờ xử lý
            </span>
          )}
          {refreshBtn(async () => { await Promise.all([loadAllData(), loadPending()]); })}
        </div>

        {pendingProducts.length === 0 ? (
          <div style={{
            padding: '52px 32px',
            borderRadius: 16,
            background: `linear-gradient(135deg, #f0fdf4, #ecfdf5)`,
            border: `1.5px dashed #86efac`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            textAlign: 'center',
          }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              background: '#dcfce7', border: '2px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircleFilled style={{ fontSize: 32, color: '#16a34a' }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d', fontFamily: "'Nunito',sans-serif", marginBottom: 6 }}>
                Không có form nào đang chờ duyệt
              </div>
              <div style={{ fontSize: 12, color: '#4d7c5f', fontWeight: 600, fontFamily: "'Nunito Sans',sans-serif" }}>
                Tất cả form đã được xử lý. Hệ thống tự động cập nhật mỗi 15 giây khi có form mới.
              </div>
            </div>
          </div>
        ) : (
          <>
            <Table
              cols={TABLE_COLS}
              rows={pendingProducts
                .slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE)
                .map((p, i) => [
                  (pendingPage - 1) * ITEMS_PER_PAGE + i + 1,
                  p.project || '—',
                  p.product_type || p.category || p.name || '—',
                  <MediaGallery mediaUrls={getMediaUrls(p)} />,
                  fmtDate(p.created_at),
                  fmtDate(p.deadline_date),
                  <Badge status="pending" />,
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {viewBtn(p)}
                    <button
                      onClick={() => handleApprove(p)}
                      disabled={processingId === p.id}
                      className="hc-btn-success"
                      style={{
                        padding: '5px 14px',
                        borderRadius: 7,
                        fontSize: 11,
                        opacity: processingId === p.id ? 0.7 : 1,
                        cursor: processingId === p.id ? 'wait' : 'pointer',
                      }}
                    >
                      {processingId === p.id
                        ? <><LoadingOutlined spin style={{ fontSize: 11 }} /> Đang xử lý...</>
                        : <><CheckOutlined /> Duyệt</>}
                    </button>
                    <button
                      onClick={() => setRejectModal({ open: true, productId: p.id, reason: '' })}
                      disabled={processingId === p.id}
                      className="hc-btn-danger"
                      style={{
                        padding: '5px 14px',
                        borderRadius: 7,
                        fontSize: 11,
                        opacity: processingId === p.id ? 0.7 : 1,
                        cursor: processingId === p.id ? 'wait' : 'pointer',
                      }}
                    >
                      <CloseOutlined /> Từ chối
                    </button>
                  </div>,
                ])}
            />
            <Pagination
              currentPage={pendingPage}
              totalPages={Math.ceil(pendingProducts.length / ITEMS_PER_PAGE)}
              totalItems={pendingProducts.length}
              onPageChange={setPendingPage}
            />
          </>
        )}
      </div>

      <FormHistoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        filterType={modalFilterType}
        filterValue={modalFilterValue}
        initialStatus={modalInitialStatus}
        allProducts={allProducts}
        
      />

      <ProductViewerModal product={viewProduct} onClose={() => setViewProduct(null)} />

      <RejectModal
        open={rejectModal.open}
        reason={rejectModal.reason}
        setReason={r => setRejectModal(prev => ({ ...prev, reason: r }))}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectModal({ open: false, productId: null, reason: '' })}
      />

      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
