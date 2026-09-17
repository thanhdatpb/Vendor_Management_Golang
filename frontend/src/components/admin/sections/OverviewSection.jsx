import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  BarChartOutlined, FolderOpenOutlined, HourglassOutlined,
  CheckCircleOutlined, CloseCircleOutlined, CheckCircleFilled,
  WarningFilled, CloseCircleFilled, AimOutlined, FireOutlined,
  FormatPainterOutlined, SmileOutlined, GlobalOutlined, RocketOutlined,
  ClockCircleOutlined, CheckOutlined, CloseOutlined, LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { HC, API_BASE_URL, ITEMS_PER_PAGE } from '../constants';
import { normalizeList, normalizeProduct, getMediaUrls, fmtDate } from '../utils';
import { playNotificationBeep } from '../audio';
import { productApi } from '../../../services/api';
import { subscribeProductChanges } from '../../../services/echo';
import { pushNotif } from '../../../utils/notifUtils';
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
        style={{ fontSize: 11, fontWeight: 800, fill: '#1A0F00', fontFamily: "'Inter',sans-serif" }}>
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
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9C7A50', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: "'Inter',sans-serif" }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#1A0F00', fontFamily: "'Inter',sans-serif", lineHeight: 1 }}>{value}</div>
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
  'Hapify84 Project': { icon: <RocketOutlined />, color: '#A855F7' },
};

function ProjectCard({ project, stats, onClick, onStatusClick }) {
  const [hovered, setHovered] = useState(false);
  const meta = PROJECT_META[project] || { icon: <FolderOpenOutlined />, color: '#6B7280' };
  const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  const pending = stats.pending ?? 0;

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
          <div style={{ fontWeight: 800, fontSize: 13, color: '#1A0F00', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project}</div>
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
            <span style={{ fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: "'Inter',sans-serif" }}>{stats.approved}</span>
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
            <span style={{ fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: "'Inter',sans-serif" }}>{pending}</span>
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
            <span style={{ fontSize: 14, fontWeight: 800, color: '#111827', fontFamily: "'Inter',sans-serif" }}>{stats.rejected}</span>
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
  const [loading, setLoading] = useState(true);
  // Danh sách "thô" chỉ để nuôi FormHistoryModal (bảng lịch sử form khi bấm vào 1
  // project/trạng thái) — KHÔNG dùng để tính số liệu thống kê nữa (xem loadAllData).
  // per_page nới rộng ra 500 (thay vì mặc định 20 của BE) để modal lịch sử không bị
  // hụt dữ liệu các form cũ; số liệu 4 card thống kê giờ đến từ productApi.stats().
  const [allProducts, setAllProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterType, setModalFilterType] = useState('');
  const [modalFilterValue, setModalFilterValue] = useState('');
  const [modalInitialStatus, setModalInitialStatus] = useState('all');
  const [formStats, setFormStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [projectStats, setProjectStats] = useState({
    'Happy Project':    { approved: 0, rejected: 0, pending: 0, total: 0 },
    'Creative Project': { approved: 0, rejected: 0, pending: 0, total: 0 },
    'Global Project':   { approved: 0, rejected: 0, pending: 0, total: 0 },
    'Hapify84 Project': { approved: 0, rejected: 0, pending: 0, total: 0 },
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

  // Đếm ở DB (COUNT theo status/project) thay vì tự đếm từ /products — endpoint đó bị
  // paginate 20/trang nên form cũ (kể cả đã duyệt) rớt khỏi trang 1 khi có form mới,
  // làm số liệu "tự nhảy mất". Xem ProductController::stats().
  const loadAllData = useCallback(async () => {
    try {
      const res = await productApi.stats();
      const body = res.data || {};
      const overall = body.overall || { pending: 0, approved: 0, rejected: 0, total: 0 };
      setFormStats(overall);

      const defaultProjectStat = { approved: 0, rejected: 0, pending: 0, total: 0 };
      const projects = ['Happy Project', 'Creative Project', 'Global Project', 'Hapify84 Project'];
      const ps = {};
      projects.forEach(proj => {
        ps[proj] = { ...defaultProjectStat, ...(body.projects?.[proj] || {}) };
      });
      setProjectStats(ps);
    } catch (err) {
      console.error('Lỗi tải thống kê:', err);
      setFormStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistoryList = useCallback(async () => {
    try {
      const res = await productApi.list({ per_page: 500 });
      setAllProducts(normalizeList(res).map(normalizeProduct));
    } catch (err) {
      console.error('Lỗi tải lịch sử form:', err);
    }
  }, []);

  const loadPending = useCallback(() => {
    return productApi.pendingApprovals()
      .then(r => {
        const newPending = normalizeList(r).map(normalizeProduct);
        const oldCount = pendingCountRef.current;

        setPendingProducts(newPending);

        // Thông báo "Yêu cầu duyệt sản phẩm mới" giờ được backend tạo 1 lần duy nhất
        // khi Seller submit (NotificationService trong ProductController::submit),
        // nên ở đây chỉ theo dõi để phát âm thanh, không tự tạo thêm thông báo nữa
        // (tránh trùng lặp 2 thông báo cho 1 form request).
        const newlySeen = newPending.filter(p => !notifiedProductIds.current.has(p.id));
        newlySeen.forEach(p => notifiedProductIds.current.add(p.id));

        if (oldCount > 0 && newlySeen.length > 0) {
          playNotificationBeep();
          window.dispatchEvent(new CustomEvent('pendingProductsUpdated', { detail: newPending }));
        }

        pendingCountRef.current = newPending.length;
      })
      .catch(err => {
        console.error('Lỗi load pending:', err);
        setPendingProducts([]);
      });
  }, []);

  const handleApprove = async (product) => {
    if (processingId === product.id) return;
    setProcessingId(product.id);

    try {
      await productApi.approve(product.id, { approved: true });

      pushNotif('staff_b', {
        type: 'product_approved',
        icon: '',
        title: 'Sản phẩm đã được duyệt',
        message: `Sản phẩm "${product.product_type}" của Seller "${getSellerName(product)}" đã được Admin duyệt. Hãy vào "Products" để gán Vendor.`,
        product_id: product.id,
        productType: product.product_type,
        sellerName: getSellerName(product),
      });

      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
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

      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
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
      console.error('Lỗi tải chi tiết sản phẩm:', err);
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
    Promise.all([loadAllData(), loadPending(), loadHistoryList()]);

    // Pusher đẩy real-time khi có thay đổi ở tab/tài khoản khác — không cần F5.
    const unsubscribe = subscribeProductChanges(() => {
      loadAllData(); loadPending(); loadHistoryList();
    });

    // Polling giữ lại làm lưới an toàn (phòng khi mất kết nối Pusher), tần suất thấp hơn
    // vì giờ real-time đã lo phần chính.
    const interval = setInterval(() => {
      if (document.hidden) return; // tab không active thì bỏ qua, đỡ tốn CPU server
      loadAllData(); loadPending(); loadHistoryList();
    }, 120000);

    return () => { clearInterval(interval); unsubscribe(); };
  }, [loadAllData, loadPending, loadHistoryList]);

  // Không có cột Deadline: deadline do role Vendor đặt (kèm gán vendor) sau khi Admin
  // duyệt, nên form đang chờ duyệt luôn chưa có deadline.
  const TABLE_COLS = ['STT', 'Project', 'Product Type', 'Hình ảnh', 'Date Request', 'Trạng thái', 'Thao tác'];

  const sHdr = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' };
  const h3S = { fontSize: 15, fontWeight: 900, color: HC.ink, margin: 0, fontFamily: "'Inter',sans-serif" };
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
        fontFamily: "'Inter',sans-serif",
        opacity: isRefreshing ? 0.8 : 1,
      }}
    >
      <ReloadOutlined style={{ fontSize: 11, animation: isRefreshing ? 'hc-spin 0.7s linear infinite' : 'none', display: 'inline-block' }} />
      {isRefreshing ? 'Đang tải...' : 'Làm mới'}
    </button>
  );

  if (loading) return <Spinner />;

  const filteredProjects = ['Happy Project', 'Creative Project', 'Global Project', 'Hapify84 Project'];

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 1440, margin: '0 auto' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Project section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, animation: 'fadeUp 0.5s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F8F9FA', border: '1.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#9C7A50' }}><AimOutlined /></div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1A0F00', fontFamily: "'Inter',sans-serif" }}>Thống Kê Theo Project</span>
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
              fontFamily: "'Inter',sans-serif"
            }}>
              {pendingProducts.length} form chờ xử lý
            </span>
          )}
          {refreshBtn(async () => { await Promise.all([loadAllData(), loadPending(), loadHistoryList()]); })}
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
              <div style={{ fontSize: 15, fontWeight: 800, color: '#15803d', fontFamily: "'Inter',sans-serif", marginBottom: 6 }}>
                Không có form nào đang chờ duyệt
              </div>
              <div style={{ fontSize: 12, color: '#4d7c5f', fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>
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
                .map((p, i) => {
                  const cell = (content, extraStyle) => (
                    <div
                      onClick={() => handleViewProduct(p)}
                      style={{ cursor: 'pointer', ...extraStyle }}
                      title="Bấm để xem chi tiết sản phẩm"
                    >
                      {content}
                    </div>
                  );
                  return [
                    cell((pendingPage - 1) * ITEMS_PER_PAGE + i + 1),
                    cell(p.project || '—'),
                    cell(p.product_type || p.category || p.name || '—', { color: HC.orangeDark, fontWeight: 700 }),
                    cell(<MediaGallery mediaUrls={getMediaUrls(p)} />),
                    cell(fmtDate(p.created_at)),
                    cell(<Badge status="pending" />),
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                  ];
                })}
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
        getSellerName={getSellerName}
      />

      <ProductViewerModal
        product={viewProduct}
        onClose={() => setViewProduct(null)}
        onApprove={(p) => { setViewProduct(null); handleApprove(p); }}
        onReject={() => { const p = viewProduct; setViewProduct(null); setRejectModal({ open: true, productId: p.id, reason: '' }); }}
      />

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
