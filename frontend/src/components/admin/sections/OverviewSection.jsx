import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { HC, API_BASE_URL } from '../constants';
import { normalizeList } from '../utils';
import { productApi } from '../../../services/api';
import { Card, Spinner } from '../ui';
import FormHistoryModal from '../modals/FormHistoryModal';

export default function OverviewSection() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSellers, setAllSellers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterType, setModalFilterType] = useState('');
  const [modalFilterValue, setModalFilterValue] = useState('');
  const [formStats, setFormStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [projectStats, setProjectStats] = useState({
    'Creative Project': { approved: 0, rejected: 0, total: 0 },
    'Happy Project': { approved: 0, rejected: 0, total: 0 },
    'Global Project': { approved: 0, rejected: 0, total: 0 },
    'Pilot Project': { approved: 0, rejected: 0, total: 0 },
  });

  // ✅ Hàm tính toán stats từ dữ liệu
  const computeStats = useCallback((products) => {
    // Form stats
    const pending = products.filter(p => p.status === 'pending').length;
    const approved = products.filter(p => p.status === 'approved').length;
    const rejected = products.filter(p => p.status === 'rejected' || p.status === 'reject').length;

    setFormStats({
      pending,
      approved,
      rejected,
      total: products.length
    });

    // Project stats
    const projects = ['Creative Project', 'Happy Project', 'Global Project', 'Pilot Project'];
    const newProjectStats = {};

    projects.forEach(project => {
      const projectProducts = products.filter(p => p.project === project);
      newProjectStats[project] = {
        approved: projectProducts.filter(p => p.status === 'approved').length,
        rejected: projectProducts.filter(p => p.status === 'rejected' || p.status === 'reject').length,
        total: projectProducts.length
      };
    });

    setProjectStats(newProjectStats);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const allRes = await productApi.list();
      const all = normalizeList(allRes);
      setAllProducts(all);

      // ✅ Tính toán stats ngay sau khi có dữ liệu
      computeStats(all);

      // Load sellers (optional, không ảnh hưởng hiển thị chính)
      const token = localStorage.getItem('auth_token');
      try {
        const usersRes = await axios.get(`${API_BASE_URL}/api/users/sellers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        let sellers = [];
        if (usersRes.data && usersRes.data.data) {
          sellers = usersRes.data.data;
        }
        setAllSellers(sellers);
      } catch (sellerErr) {
        console.warn('Không thể tải danh sách seller:', sellerErr);
        setAllSellers([]);
      }

    } catch (err) {
      console.error('❌ Lỗi tải dữ liệu:', err);
      setFormStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [computeStats]);

  // ✅ Chỉ cần load pending count riêng nếu cần, nhưng có thể bỏ vì đã có trong allProducts
  // Hoặc giữ lại để có realtime pending count
  const loadPendingCount = useCallback(async () => {
    try {
      const pendingRes = await productApi.pendingApprovals();
      const pending = normalizeList(pendingRes);
      // Chỉ cập nhật pending, giữ nguyên approved/rejected/total
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
    const interval = setInterval(() => {
      loadAllData();
      loadPendingCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadAllData, loadPendingCount]);

  if (loading) return <Spinner />;

  // Debug log để kiểm tra
  console.log('🔍 OverviewSection - formStats:', formStats);
  console.log('🔍 OverviewSection - projectStats:', projectStats);
  console.log('🔍 OverviewSection - allProducts count:', allProducts.length);

  const displayProjects = ['Creative Project', 'Happy Project', 'Global Project', 'Pilot Project'];
  const projectColors = {
    'Creative Project': { bg: '#FEF3DC', border: '#F59E0B', text: '#92400E', light: '#FFFBEB' },
    'Happy Project': { bg: '#ECFDF5', border: '#10B981', text: '#065F46', light: '#F0FDF4' },
    'Global Project': { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', light: '#F8FAFC' },
    'Pilot Project': { bg: '#F3E8FF', border: '#A855F7', text: '#6B21A5', light: '#FAF5FF' },
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: HC.ink,
          marginBottom: 12,
          fontFamily: "'Nunito',sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: 18 }}>📋</span>
          Thống Kê Form Từ Staff
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <div onClick={() => handleCardClick('status', 'all', 'Tất cả Form Request')} style={{ cursor: 'pointer' }}>
            <Card label="Tổng Form Request" value={formStats.total.toLocaleString()} color={HC.orange} />
          </div>
          <div onClick={() => handleCardClick('status', 'pending', 'Form Chờ Duyệt')} style={{ cursor: 'pointer' }}>
            <Card label="Form Chờ Duyệt" value={formStats.pending.toLocaleString()} color={HC.warning} />
          </div>
          <div onClick={() => handleCardClick('status', 'approved', 'Form Đã Duyệt')} style={{ cursor: 'pointer' }}>
            <Card label="Form Đã Duyệt" value={formStats.approved.toLocaleString()} color={HC.success} />
          </div>
          <div onClick={() => handleCardClick('status', 'rejected', 'Form Từ Chối')} style={{ cursor: 'pointer' }}>
            <Card label="Form Từ Chối" value={formStats.rejected.toLocaleString()} color={HC.danger} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: HC.ink,
          marginBottom: 12,
          fontFamily: "'Nunito',sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          Thống Kê Theo Project
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {displayProjects.map(project => {
            const stats = projectStats[project] || { approved: 0, rejected: 0, total: 0 };
            const colors = projectColors[project];
            const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;

            return (
              <div
                key={project}
                onClick={() => handleCardClick('project', project, `Lịch sử Form - ${project}`)}
                style={{
                  background: HC.surface,
                  borderRadius: 16,
                  border: `1.5px solid ${colors.border}`,
                  overflow: 'hidden',
                  boxShadow: HC.shadow,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = HC.shadowStrong;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = HC.shadow;
                }}
              >
                <div style={{
                  padding: '14px 18px',
                  background: colors.bg,
                  borderBottom: `1.5px solid ${colors.border}`,
                }}>
                  <div style={{
                    fontWeight: 900,
                    fontSize: 16,
                    color: colors.text,
                    fontFamily: "'Nunito',sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    {project}
                    <span style={{
                      fontSize: 11,
                      background: colors.border + '20',
                      padding: '2px 10px',
                      borderRadius: 20,
                      color: colors.text,
                    }}>
                      {stats.total} form
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px 18px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: HC.success }}>
                        <span>✅</span> Đã duyệt
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 18, color: HC.success, fontFamily: "'Nunito',monospace" }}>
                        {stats.approved}
                      </span>
                    </div>
                    <div style={{ height: 6, background: HC.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%`,
                        height: '100%',
                        background: HC.success,
                        borderRadius: 3,
                      }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: HC.danger }}>
                        <span>❌</span> Từ chối
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 18, color: HC.danger, fontFamily: "'Nunito',monospace" }}>
                        {stats.rejected}
                      </span>
                    </div>
                    <div style={{ height: 6, background: HC.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%`,
                        height: '100%',
                        background: HC.danger,
                        borderRadius: 3,
                      }} />
                    </div>
                  </div>

                  <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: `1px dashed ${HC.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 11, color: HC.muted, fontWeight: 600 }}>Tỷ lệ duyệt</span>
                    <span style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: approvalRate >= 70 ? HC.success : approvalRate >= 40 ? HC.warning : HC.danger,
                      fontFamily: "'Nunito',monospace",
                    }}>
                      {approvalRate}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
