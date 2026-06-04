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
