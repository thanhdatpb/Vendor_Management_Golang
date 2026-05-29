import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { HC, API_BASE_URL } from '../constants';
import { normalizeList } from '../utils';
import { productApi } from '../../../services/api';
import { Spinner } from '../ui';
import FormHistoryModal from '../modals/FormHistoryModal';

// ── Mini donut / ring progress ─────────────────────────────
function RingProgress({ percent, color, size = 56 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0E4CC" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 800, fill: color, fontFamily: "'Nunito',sans-serif" }}>
        {percent}%
      </text>
    </svg>
  );
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, icon, color, gradient, onClick, subLabel }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? gradient : '#fff',
        borderRadius: 18,
        border: `1.5px solid ${hovered ? color + '55' : '#F0E4CC'}`,
        boxShadow: hovered ? `0 12px 40px ${color}25` : '0 2px 12px rgba(0,0,0,0.05)',
        padding: '20px 22px',
        cursor: 'pointer',
        transition: 'all 0.22s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -18, right: -18, width: 80, height: 80, borderRadius: '50%', background: color + '18', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B8956A', fontFamily: "'Nunito',sans-serif", marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color, fontFamily: "'Nunito',sans-serif", lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
          {subLabel && <div style={{ fontSize: 11, color: '#B8956A', marginTop: 6, fontWeight: 600 }}>{subLabel}</div>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '18', border: `1.5px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, ${color}55)`, borderRadius: '0 0 18px 18px', opacity: hovered ? 1 : 0.4, transition: 'opacity 0.22s' }} />
    </div>
  );
}

// ── Deadline Warning Panel ─────────────────────────────────
function DeadlinePanel({ products, onViewAll }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const urgentForms = products
    .filter(p => {
      if (p.status !== 'pending') return false;
      if (!p.deadline_date) return false;
      const dl = new Date(p.deadline_date);
      dl.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    })
    .map(p => {
      const dl = new Date(p.deadline_date);
      dl.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
      return { ...p, diffDays };
    })
    .sort((a, b) => a.diffDays - b.diffDays)
    .slice(0, 5);

  const getUrgencyStyle = (days) => {
    if (days < 0)  return { dot: '#dc2626', bg: '#fef2f2', text: '#991b1b', label: 'Đã quá hạn' };
    if (days === 0) return { dot: '#dc2626', bg: '#fef2f2', text: '#991b1b', label: 'Hết hạn hôm nay' };
    if (days <= 2)  return { dot: '#f59e0b', bg: '#fffbeb', text: '#92400e', label: `Còn ${days} ngày` };
    return            { dot: '#3b82f6', bg: '#eff6ff', text: '#1e40af', label: `Còn ${days} ngày` };
  };

  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #F0E4CC', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1.5px solid #F0E4CC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: urgentForms.length > 0 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#16a34a,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            {urgentForms.length > 0 ? '⚠️' : '✅'}
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Deadline Sắp Đến</div>
            <div style={{ fontSize: 10, color: '#B8956A', fontWeight: 600 }}>Form pending trong 7 ngày tới</div>
          </div>
        </div>
        {urgentForms.length > 0 && (
          <span style={{ padding: '3px 10px', borderRadius: 20, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b', fontSize: 11, fontWeight: 800 }}>
            {urgentForms.length} form
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: urgentForms.length === 0 ? '0' : '4px 0' }}>
        {urgentForms.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', fontFamily: "'Nunito',sans-serif" }}>Không có form nào sắp hết hạn</div>
            <div style={{ fontSize: 11, color: '#B8956A', marginTop: 4 }}>Tất cả deadline đều ổn</div>
          </div>
        ) : (
          urgentForms.map((p, i) => {
            const urg = getUrgencyStyle(p.diffDays);
            const seller = p.seller_name || p.sellerName || p.user_name || '—';
            return (
              <div
                key={p.id || i}
                onClick={onViewAll}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', cursor: 'pointer', borderBottom: i < urgentForms.length - 1 ? '1px solid #FBF3E4' : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FFFBF4'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: urg.dot, flexShrink: 0, boxShadow: `0 0 0 3px ${urg.dot}30` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#3D2B0F', fontFamily: "'Nunito Sans',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.product_type || p.name || 'Sản phẩm'}
                  </div>
                  <div style={{ fontSize: 10, color: '#B8956A', fontWeight: 600, marginTop: 1 }}>
                    {seller} · {p.project || '—'}
                  </div>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: 8, background: urg.bg, color: urg.text, fontSize: 10, fontWeight: 800, fontFamily: "'Nunito',sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {urg.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Product Type Distribution Panel ────────────────────────
function ProductTypePanel({ products, onViewAll }) {
  // Group by product_type, count total & approved
  const typeMap = {};
  products.forEach(p => {
    const type = p.product_type || p.category || p.name || 'Khác';
    if (!typeMap[type]) typeMap[type] = { total: 0, approved: 0 };
    typeMap[type].total++;
    if (p.status === 'approved') typeMap[type].approved++;
  });

  const types = Object.entries(typeMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  const maxTotal = types.length > 0 ? types[0][1].total : 1;

  const barColors = ['#F5A623', '#3B82F6', '#10B981', '#A855F7', '#EF4444', '#F59E0B'];

  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #F0E4CC', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1.5px solid #F0E4CC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#F5A623,#E09415)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📦</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Phân Bố Product Type</div>
            <div style={{ fontSize: 10, color: '#B8956A', fontWeight: 600 }}>Loại sản phẩm được submit nhiều nhất</div>
          </div>
        </div>
        <span style={{ padding: '3px 10px', borderRadius: 20, background: '#FEF3DC', border: '1.5px solid #FDE8B8', color: '#92400E', fontSize: 11, fontWeight: 800 }}>
          {types.length} loại
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: types.length === 0 ? '0' : '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {types.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#B8956A' }}>Chưa có dữ liệu sản phẩm</div>
          </div>
        ) : (
          types.map(([type, counts], i) => {
            const barW = maxTotal > 0 ? (counts.total / maxTotal) * 100 : 0;
            const approvedW = counts.total > 0 ? (counts.approved / counts.total) * 100 : 0;
            const color = barColors[i % barColors.length];
            return (
              <div
                key={type}
                onClick={onViewAll}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#3D2B0F', fontFamily: "'Nunito Sans',sans-serif" }}>{type}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#B8956A', fontWeight: 600 }}>
                      ✅ {counts.approved}/{counts.total}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 900, color, fontFamily: "'Nunito',sans-serif", minWidth: 20, textAlign: 'right' }}>
                      {counts.total}
                    </span>
                  </div>
                </div>
                {/* Background bar (total) */}
                <div style={{ height: 8, background: '#F0E4CC', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barW}%`, background: color + '40', borderRadius: 4, transition: 'width 0.6s ease' }} />
                  {/* Foreground bar (approved) */}
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(approvedW / 100) * barW}%`, background: color, borderRadius: 4, transition: 'width 0.7s ease' }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const PROJECT_META = {
  'Creative Project': { icon: '🎨', gradient: 'linear-gradient(135deg,#FEF3DC,#FFFBEB)', border: '#F59E0B', color: '#92400E', dot: '#F59E0B' },
  'Happy Project':    { icon: '😊', gradient: 'linear-gradient(135deg,#ECFDF5,#F0FDF4)', border: '#10B981', color: '#065F46', dot: '#10B981' },
  'Global Project':   { icon: '🌏', gradient: 'linear-gradient(135deg,#EFF6FF,#F8FAFC)', border: '#3B82F6', color: '#1E40AF', dot: '#3B82F6' },
  'Pilot Project':    { icon: '🚀', gradient: 'linear-gradient(135deg,#F3E8FF,#FAF5FF)', border: '#A855F7', color: '#6B21A5', dot: '#A855F7' },
};

function ProjectCard({ project, stats, onClick }) {
  const [hovered, setHovered] = useState(false);
  const meta = PROJECT_META[project] || { icon: '📁', gradient: '#fff', border: '#F0E4CC', color: '#3D2B0F', dot: '#F5A623' };
  const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  const pending = stats.total - stats.approved - stats.rejected;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? meta.gradient : '#fff',
        borderRadius: 18,
        border: `1.5px solid ${hovered ? meta.border : '#F0E4CC'}`,
        boxShadow: hovered ? `0 12px 40px ${meta.dot}25` : '0 2px 12px rgba(0,0,0,0.05)',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.22s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
      }}
    >
      <div style={{ padding: '14px 18px 12px', borderBottom: `1.5px solid ${hovered ? meta.border + '55' : '#F0E4CC'}`, display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.22s' }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: meta.dot + '20', border: `1.5px solid ${meta.dot}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: meta.color, fontFamily: "'Nunito',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project}</div>
          <div style={{ fontSize: 10, color: '#B8956A', fontWeight: 600, marginTop: 1 }}>{stats.total} form tổng cộng</div>
        </div>
        <RingProgress percent={approvalRate} color={meta.dot} size={50} />
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Đã duyệt</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#16a34a', fontFamily: "'Nunito',sans-serif" }}>{stats.approved}</span>
          </div>
          <div style={{ height: 5, background: '#F0E4CC', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
        </div>
        {pending > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>Chờ duyệt</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#92400e', fontFamily: "'Nunito',sans-serif" }}>{pending}</span>
            </div>
            <div style={{ height: 5, background: '#F0E4CC', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${stats.total > 0 ? (pending / stats.total) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#f59e0b,#fcd34d)', borderRadius: 3, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        )}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b' }}>Từ chối</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#991b1b', fontFamily: "'Nunito',sans-serif" }}>{stats.rejected}</span>
          </div>
          <div style={{ height: 5, background: '#F0E4CC', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg,#dc2626,#f87171)', borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function OverviewSection() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSellers, setAllSellers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterType, setModalFilterType] = useState('');
  const [modalFilterValue, setModalFilterValue] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [formStats, setFormStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [projectStats, setProjectStats] = useState({
    'Creative Project': { approved: 0, rejected: 0, total: 0 },
    'Happy Project':    { approved: 0, rejected: 0, total: 0 },
    'Global Project':   { approved: 0, rejected: 0, total: 0 },
    'Pilot Project':    { approved: 0, rejected: 0, total: 0 },
  });

  const computeStats = useCallback((products) => {
    const pending  = products.filter(p => p.status === 'pending').length;
    const approved = products.filter(p => p.status === 'approved').length;
    const rejected = products.filter(p => p.status === 'rejected' || p.status === 'reject').length;
    setFormStats({ pending, approved, rejected, total: products.length });
    const projects = ['Creative Project', 'Happy Project', 'Global Project', 'Pilot Project'];
    const ps = {};
    projects.forEach(proj => {
      const pp = products.filter(p => p.project === proj);
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
      const all = normalizeList(allRes);
      setAllProducts(all);
      computeStats(all);
      const token = localStorage.getItem('auth_token');
      try {
        const usersRes = await axios.get(`${API_BASE_URL}/api/users/sellers`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        setAllSellers(usersRes.data?.data || []);
      } catch { setAllSellers([]); }
    } catch (err) {
      console.error('❌ Lỗi tải dữ liệu:', err);
      setFormStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [computeStats]);

  const loadPendingCount = useCallback(async () => {
    try {
      const pendingRes = await productApi.pendingApprovals();
      const pending = normalizeList(pendingRes);
      setFormStats(prev => ({ ...prev, pending: pending.length }));
    } catch (err) {
      console.error('Lỗi tải pending:', err);
    }
  }, []);

  const handleCardClick = (type, value, label) => {
    setModalTitle(label);
    setModalFilterType(type);
    setModalFilterValue(value);
    setModalOpen(true);
  };

  useEffect(() => {
    Promise.all([loadAllData(), loadPendingCount()]);
    const interval = setInterval(() => { loadAllData(); loadPendingCount(); }, 30000);
    return () => clearInterval(interval);
  }, [loadAllData, loadPendingCount]);

  if (loading) return <Spinner />;

  const displayProjects = ['Creative Project', 'Happy Project', 'Global Project', 'Pilot Project'];
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
    <div style={{ fontFamily: "'Nunito Sans',sans-serif" }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, animation: 'fadeUp 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#F5A623,#E09415)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 12px rgba(245,166,35,0.3)' }}>📊</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Thống Kê Tổng Quan</div>
            <div style={{ fontSize: 11, color: '#B8956A', fontWeight: 600, marginTop: 1 }}>Cập nhật mỗi 30 giây · {formStats.total} form tổng cộng</div>
          </div>
        </div>
        <div style={{ padding: '6px 16px', borderRadius: 20, background: overallRate >= 70 ? '#ecfdf5' : overallRate >= 40 ? '#fffbeb' : '#fef2f2', border: `1.5px solid ${overallRate >= 70 ? '#bbf7d0' : overallRate >= 40 ? '#fde68a' : '#fecaca'}`, color: overallRate >= 70 ? '#166534' : overallRate >= 40 ? '#92400e' : '#991b1b', fontSize: 12, fontWeight: 800, fontFamily: "'Nunito',sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{overallRate >= 70 ? '✅' : overallRate >= 40 ? '⚠️' : '🔴'}</span>
          Tỷ lệ duyệt: {overallRate}%
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28, animation: 'fadeUp 0.45s ease' }}>
        <StatCard label="Tổng Form Request" value={formStats.total} icon="📁" color="#F5A623" gradient="linear-gradient(135deg,#FEF3DC,#FFFBF4)" subLabel="Tất cả trạng thái" onClick={() => handleCardClick('status', 'all', 'Tất cả Form Request')} />
        <StatCard label="Chờ Duyệt" value={formStats.pending} icon="⏳" color="#f59e0b" gradient="linear-gradient(135deg,#fffbeb,#fef3c7)" subLabel={formStats.pending > 0 ? 'Cần xử lý ngay' : 'Không có form chờ'} onClick={() => handleCardClick('status', 'pending', 'Form Chờ Duyệt')} />
        <StatCard label="Đã Duyệt" value={formStats.approved} icon="✅" color="#16a34a" gradient="linear-gradient(135deg,#ecfdf5,#f0fdf4)" subLabel={`${overallRate}% tỷ lệ duyệt`} onClick={() => handleCardClick('status', 'approved', 'Form Đã Duyệt')} />
        <StatCard label="Từ Chối" value={formStats.rejected} icon="❌" color="#dc2626" gradient="linear-gradient(135deg,#fef2f2,#fff1f1)" subLabel={formStats.rejected > 0 ? `${Math.round((formStats.rejected / (formStats.total || 1)) * 100)}% tổng form` : 'Không có từ chối'} onClick={() => handleCardClick('status', 'rejected', 'Form Từ Chối')} />
      </div>

      {/* ── Project section header + filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, animation: 'fadeUp 0.5s ease', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Thống Kê Theo Project</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all',       label: 'Tất cả' },
            { id: 'active',    label: '🔥 Có hoạt động' },
            { id: 'pending',   label: '⏳ Còn chờ' },
            { id: 'completed', label: '✅ Hoàn tất' },
          ].map(f => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${activeFilter === f.id ? '#F5A623' : '#F0E4CC'}`, background: activeFilter === f.id ? 'linear-gradient(135deg,#F5A623,#E09415)' : '#fff', color: activeFilter === f.id ? '#fff' : '#7A5C32', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", transition: 'all 0.18s' }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── Project Cards grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, animation: 'fadeUp 0.55s ease', marginBottom: 20 }}>
        {filteredProjects.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: '#B8956A', fontSize: 13, fontWeight: 600, background: '#FFFBF4', borderRadius: 16, border: '1.5px dashed #F0E4CC' }}>
            Không có project nào phù hợp với bộ lọc này
          </div>
        ) : filteredProjects.map(project => (
          <ProjectCard
            key={project}
            project={project}
            stats={projectStats[project] || { approved: 0, rejected: 0, total: 0 }}
            onClick={() => handleCardClick('project', project, `Lịch sử Form — ${project}`)}
          />
        ))}
      </div>

      {/* ── Bottom Row: Deadline + Product Type ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, animation: 'fadeUp 0.6s ease' }}>
        <DeadlinePanel
          products={allProducts}
          onViewAll={() => handleCardClick('status', 'pending', 'Form Chờ Duyệt')}
        />
        <ProductTypePanel
          products={allProducts}
          onViewAll={() => handleCardClick('status', 'all', 'Tất cả Form Request')}
        />
      </div>

      <FormHistoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        filterType={modalFilterType}
        filterValue={modalFilterValue}
        allProducts={allProducts}
        allSellers={allSellers}
      />
    </div>
  );
}
