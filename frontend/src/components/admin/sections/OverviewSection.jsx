import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { HC, API_BASE_URL } from '../constants';
import { normalizeList } from '../utils';
import { productApi } from '../../../services/api';
import { Spinner } from '../ui';
import FormHistoryModal from '../modals/FormHistoryModal';

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
        border: `1.5px solid ${hovered ? color : '#F0E4CC'}`,
        boxShadow: hovered ? `0 8px 24px ${color}15` : '0 2px 8px rgba(0,0,0,0.02)',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9C7A50', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: "'Nunito',sans-serif" }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1A0F00', fontFamily: "'Nunito',sans-serif", lineHeight: 1 }}>{value}</div>
          {subLabel && <div style={{ fontSize: 11, color: '#B8956A', marginTop: 8, fontWeight: 600 }}>{subLabel}</div>}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: color + '15', color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
      </div>
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
    <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #F0E4CC', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #F0E4CC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: urgentForms.length > 0 ? '#fffbeb' : '#ecfdf5', color: urgentForms.length > 0 ? '#f59e0b' : '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            {urgentForms.length > 0 ? '⚠️' : '✅'}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Deadline Sắp Đến</div>
            <div style={{ fontSize: 11, color: '#9C7A50', fontWeight: 600, marginTop: 2 }}>Form pending trong 7 ngày tới</div>
          </div>
        </div>
        {urgentForms.length > 0 && (
          <span style={{ padding: '4px 12px', borderRadius: 20, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b', fontSize: 11, fontWeight: 800 }}>
            {urgentForms.length} form
          </span>
        )}
      </div>

      <div style={{ flex: 1, padding: urgentForms.length === 0 ? '0' : '8px 0' }}>
        {urgentForms.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#10B981', fontFamily: "'Nunito',sans-serif" }}>Không có form nào sắp hết hạn</div>
            <div style={{ fontSize: 12, color: '#9C7A50', marginTop: 4 }}>Tất cả deadline đều ổn</div>
          </div>
        ) : (
          urgentForms.map((p, i) => {
            const urg = getUrgencyStyle(p.diffDays);
            const seller = p.seller_name || p.sellerName || p.user_name || '—';
            return (
              <div
                key={p.id || i}
                onClick={onViewAll}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer', borderBottom: i < urgentForms.length - 1 ? '1px solid #FBF3E4' : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#FFFBF4'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: urg.dot, flexShrink: 0, boxShadow: `0 0 0 3px ${urg.dot}20` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A0F00', fontFamily: "'Nunito Sans',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.product_type || p.name || 'Sản phẩm'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9C7A50', fontWeight: 600, marginTop: 2 }}>
                    {seller} · {p.project || '—'}
                  </div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 8, background: urg.bg, color: urg.text, fontSize: 11, fontWeight: 800, fontFamily: "'Nunito',sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
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
  const barColors = ['#F5A623', '#4B5563', '#8B5CF6', '#10B981', '#F43F5E', '#0EA5E9'];

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #F0E4CC', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #F0E4CC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF8EE', color: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📦</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Phân Bố Product Type</div>
            <div style={{ fontSize: 11, color: '#9C7A50', fontWeight: 600, marginTop: 2 }}>Loại sản phẩm được submit nhiều nhất</div>
          </div>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 20, background: '#F8F9FA', border: '1.5px solid #E5E7EB', color: '#4B5563', fontSize: 11, fontWeight: 800 }}>
          {types.length} loại
        </span>
      </div>

      <div style={{ flex: 1, padding: types.length === 0 ? '0' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {types.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#9C7A50' }}>Chưa có dữ liệu sản phẩm</div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1A0F00', fontFamily: "'Nunito Sans',sans-serif" }}>{type}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#9C7A50', fontWeight: 600 }}>
                      ✅ {counts.approved}/{counts.total}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#1A0F00', fontFamily: "'Nunito',sans-serif", minWidth: 24, textAlign: 'right' }}>
                      {counts.total}
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barW}%`, background: color + '30', borderRadius: 3, transition: 'width 0.6s ease' }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${(approvedW / 100) * barW}%`, background: color, borderRadius: 3, transition: 'width 0.7s ease' }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Project Card ───────────────────────────────────────────
const PROJECT_META = {
  'Creative Project': { icon: '🎨', color: '#F5A623' },
  'Happy Project':    { icon: '😊', color: '#10B981' },
  'Global Project':   { icon: '🌏', color: '#3B82F6' },
  'Pilot Project':    { icon: '🚀', color: '#A855F7' },
};

function ProjectCard({ project, stats, onClick }) {
  const [hovered, setHovered] = useState(false);
  const meta = PROJECT_META[project] || { icon: '📁', color: '#6B7280' };
  const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  const pending = stats.total - stats.approved - stats.rejected;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        border: `1.5px solid ${hovered ? meta.color : '#F0E4CC'}`,
        boxShadow: hovered ? `0 8px 24px ${meta.color}15` : '0 2px 8px rgba(0,0,0,0.02)',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #F0E4CC', display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.2s' }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: '#F8F9FA', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#1A0F00', fontFamily: "'Nunito',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{project}</div>
          <div style={{ fontSize: 11, color: '#9C7A50', fontWeight: 600, marginTop: 2 }}>{stats.total} form tổng cộng</div>
        </div>
        <RingProgress percent={approvalRate} color={meta.color} size={46} />
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
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
        {pending > 0 && (
          <div>
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
        )}
        <div>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, animation: 'fadeUp 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFF8EE', border: '1.5px solid #FDE8B8', color: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📊</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Thống Kê Tổng Quan</div>
            <div style={{ fontSize: 12, color: '#9C7A50', fontWeight: 600, marginTop: 2 }}>Cập nhật mỗi 30 giây · {formStats.total} form tổng cộng</div>
          </div>
        </div>
        <div style={{ padding: '6px 16px', borderRadius: 20, background: overallRate >= 70 ? '#ecfdf5' : overallRate >= 40 ? '#fffbeb' : '#fef2f2', border: `1.5px solid ${overallRate >= 70 ? '#bbf7d0' : overallRate >= 40 ? '#fde68a' : '#fecaca'}`, color: overallRate >= 70 ? '#166534' : overallRate >= 40 ? '#92400e' : '#991b1b', fontSize: 12, fontWeight: 800, fontFamily: "'Nunito',sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{overallRate >= 70 ? '✅' : overallRate >= 40 ? '⚠️' : '🔴'}</span>
          Tỷ lệ duyệt: {overallRate}%
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32, animation: 'fadeUp 0.45s ease' }}>
        <StatCard label="Tổng Form Request" value={formStats.total} icon="📁" color="#F5A623" subLabel="Tất cả trạng thái" onClick={() => handleCardClick('status', 'all', 'Tất cả Form Request')} />
        <StatCard label="Chờ Duyệt" value={formStats.pending} icon="⏳" color="#F59E0B" subLabel={formStats.pending > 0 ? 'Cần xử lý ngay' : 'Không có form chờ'} onClick={() => handleCardClick('status', 'pending', 'Form Chờ Duyệt')} />
        <StatCard label="Đã Duyệt" value={formStats.approved} icon="✅" color="#10B981" subLabel={`${overallRate}% tỷ lệ duyệt`} onClick={() => handleCardClick('status', 'approved', 'Form Đã Duyệt')} />
        <StatCard label="Từ Chối" value={formStats.rejected} icon="❌" color="#EF4444" subLabel={formStats.rejected > 0 ? `${Math.round((formStats.rejected / (formStats.total || 1)) * 100)}% tổng form` : 'Không có từ chối'} onClick={() => handleCardClick('status', 'rejected', 'Form Từ Chối')} />
      </div>

      {/* ── Project section header + filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, animation: 'fadeUp 0.5s ease', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F8F9FA', border: '1.5px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎯</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1A0F00', fontFamily: "'Nunito',sans-serif" }}>Thống Kê Theo Project</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'all',       label: 'Tất cả' },
            { id: 'active',    label: '🔥 Có hoạt động' },
            { id: 'pending',   label: '⏳ Còn chờ' },
            { id: 'completed', label: '✅ Hoàn tất' },
          ].map(f => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{ padding: '6px 16px', borderRadius: 20, border: `1.5px solid ${activeFilter === f.id ? '#F5A623' : '#F0E4CC'}`, background: activeFilter === f.id ? '#FFF8EE' : '#fff', color: activeFilter === f.id ? '#F5A623' : '#9C7A50', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", transition: 'all 0.2s' }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── Project Cards grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, animation: 'fadeUp 0.55s ease', marginBottom: 32 }}>
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
