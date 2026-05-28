import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { HC } from '../constants';
import { vendorApi } from '../../../services/api';
import { Spinner, EmptyState, BestSellerBadge } from '../ui';

export default function VendorsSection() {
  const [vendorList, setVendorList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [filters, setFilters] = useState({
    product_type: '',
    vendor_type: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const uniqueProductTypes = useRef([]);
  const uniqueVendorTypes = useRef([]);

  // Load vendors từ API (giống Staff B)
  const loadVendors = useCallback(async () => {
    setLoading(true);
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

      console.log('📦 Admin - Vendor list loaded:', list.length);
      setVendorList(list);

      // Cập nhật unique values cho filter
      uniqueProductTypes.current = [...new Set(list.map(v => v.product_type).filter(Boolean))];
      uniqueVendorTypes.current = [...new Set(list.map(v => v.vendor_type).filter(Boolean))];
    } catch (err) {
      console.error('Lỗi tải vendor:', err);
      setApiError(err.response?.data?.message || err.message || 'Lỗi tải dữ liệu');
      setVendorList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh mỗi 30 giây
  useEffect(() => {
    loadVendors();
    const interval = setInterval(loadVendors, 30000);
    return () => clearInterval(interval);
  }, [loadVendors]);

  const applyFilters = useCallback(() => {
    let result = [...vendorList];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(v =>
        (v.name && v.name.toLowerCase().includes(term)) ||
        (v.product_type && v.product_type.toLowerCase().includes(term)) ||
        (v.vendor_type && v.vendor_type.toLowerCase().includes(term))
      );
    }
    if (filters.product_type) {
      result = result.filter(v => v.product_type === filters.product_type);
    }
    if (filters.vendor_type) {
      result = result.filter(v => v.vendor_type === filters.vendor_type);
    }
    setFilteredList(result);
  }, [vendorList, searchTerm, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilters({ product_type: '', vendor_type: '' });
    setShowFilters(false);
  };

  const TH = (extra = {}) => ({
    padding: '8px 10px',
    fontWeight: 900,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    textAlign: 'center',
    color: '#fff',
    background: HC.orangeDark,
    border: `1px solid ${HC.orange}`,
    fontFamily: "'Nunito',sans-serif",
    ...extra
  });
  const TD = (extra = {}) => ({
    padding: '9px 10px',
    fontSize: 12,
    color: HC.ink2,
    border: `1px solid ${HC.border}`,
    textAlign: 'center',
    verticalAlign: 'middle',
    background: HC.surface2,
    fontFamily: "'Nunito Sans',sans-serif",
    ...extra
  });
  const TDalt = (extra = {}) => ({ ...TD(extra), background: HC.orangePale });

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
            Danh sách Vendor
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, fontWeight: 700, color: HC.brown, fontFamily: "'Nunito',sans-serif" }}>
            👁 Chế độ chỉ xem
          </div>
        </div>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
          Danh sách Vendor
          <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>
            {filteredList.length} / {vendorList.length} vendor
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <SearchOutlined style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: HC.muted, fontSize: 14 }} />
            <input
              type="text"
              placeholder="Tìm theo Vendor Name, Product Type hoặc Vendor Type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '8px 12px 8px 36px',
                borderRadius: 10,
                border: `1.5px solid ${HC.border}`,
                background: HC.surface,
                fontSize: 12,
                width: 320,
                outline: 'none',
                fontFamily: "'Nunito Sans',sans-serif",
                transition: 'all 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = HC.orange}
              onBlur={e => e.target.style.borderColor = HC.border}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: showFilters ? HC.orangeLight : HC.surface,
              border: `1.5px solid ${showFilters ? HC.orange : HC.border}`,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: showFilters ? HC.orangeDark : HC.brown,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: "'Nunito',sans-serif",
            }}
          >
            <FilterOutlined /> Lọc
          </button>

          <button
            onClick={async () => {
              if (isRefreshing) return;
              setIsRefreshing(true);
              try { await loadVendors(); } finally { setIsRefreshing(false); }
            }}
            disabled={isRefreshing}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: isRefreshing ? HC.orangeLight : HC.cream,
              border: `1.5px solid ${isRefreshing ? HC.orangeMid : HC.border}`,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: isRefreshing ? HC.orangeDark : HC.brown,
              fontFamily: "'Nunito',sans-serif",
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'all 0.2s',
              opacity: isRefreshing ? 0.85 : 1,
            }}
          >
            <span style={{ display: 'inline-block', animation: isRefreshing ? 'spin360 0.7s linear infinite' : 'none' }}>↻</span>
            {isRefreshing ? 'Đang tải...' : 'Làm mới'}
          </button>

          {(searchTerm || filters.product_type || filters.vendor_type) && (
            <button
              onClick={resetFilters}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: HC.cream,
                border: `1.5px solid ${HC.border}`,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: HC.muted,
                fontFamily: "'Nunito',sans-serif",
              }}
            >
              Xóa lọc
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, fontWeight: 700, color: HC.brown, fontFamily: "'Nunito',sans-serif" }}>
            👁 Chế độ chỉ xem
          </div>
        </div>
      </div>

      {apiError && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {apiError}</span>
          <button onClick={loadVendors} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button>
        </div>
      )}

      {showFilters && (
        <div style={{
          marginBottom: 20,
          padding: '16px 20px',
          borderRadius: 14,
          background: HC.surface,
          border: `1.5px solid ${HC.border}`,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: HC.muted, marginBottom: 5, display: 'block', fontFamily: "'Nunito',sans-serif" }}>Product Type</label>
            <select
              value={filters.product_type}
              onChange={(e) => setFilters(prev => ({ ...prev, product_type: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                border: `1.5px solid ${HC.border}`,
                background: HC.surface2,
                fontSize: 12,
                outline: 'none',
                fontFamily: "'Nunito Sans',sans-serif"
              }}
            >
              <option value="">Tất cả</option>
              {uniqueProductTypes.current.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: HC.muted, marginBottom: 5, display: 'block', fontFamily: "'Nunito',sans-serif" }}>Vendor Type</label>
            <select
              value={filters.vendor_type}
              onChange={(e) => setFilters(prev => ({ ...prev, vendor_type: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                border: `1.5px solid ${HC.border}`,
                background: HC.surface2,
                fontSize: 12,
                outline: 'none',
                fontFamily: "'Nunito Sans',sans-serif"
              }}
            >
              <option value="">Tất cả</option>
              {uniqueVendorTypes.current.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={() => setShowFilters(false)}
              style={{
                padding: '9px 20px',
                borderRadius: 10,
                background: HC.orange,
                border: 'none',
                color: '#fff',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: "'Nunito',sans-serif"
              }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 12, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, color: HC.brown, fontFamily: "'Nunito Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span>Danh sách vendor được quản lý bởi <b>Staff Dashboard B</b>. Trang này chỉ hiển thị để tham khảo.</span>
      </div>

      {filteredList.length === 0 ? (
        <EmptyState msg={vendorList.length === 0 ? "Chưa có vendor nào được thêm vào hệ thống" : "Không tìm thấy vendor phù hợp với điều kiện lọc"} />
      ) : (
        <div style={{ overflowX: 'auto', boxShadow: HC.shadow, borderRadius: 14, border: `1.5px solid ${HC.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...TH(), borderRadius: '14px 0 0 0', minWidth: 160 }}>Vendor Name</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 130 }}>Product Type</th>
                <th rowSpan={2} style={TH({ minWidth: 120 })}>Vendor Type</th>
                {/* 🆕 Cột Pricing gộp - đặt trước Detail */}
                <th rowSpan={2} style={{ ...TH({ minWidth: 100, background: HC.orange }), color: '#fff' }}>💰 Pricing</th>
                <th colSpan={2} style={TH()}>Detail</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orange, borderLeft: `2px solid ${HC.orangeDark}` }}>Economy</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orangeDark }}>Fast</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orange }}>Express</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orangeDark, borderRadius: '0 14px 0 0' }}>Overnight</th>
              </tr>
              <tr>
                <th style={TH({ minWidth: 80 })}>Size</th>
                <th style={TH({ minWidth: 90 })}>Optional</th>
                {['Economy', 'Fast', 'Express', 'Overnight'].map(s => [
                  <th key={`${s}-p`} style={{ ...TH({ minWidth: 80, background: s === 'Fast' || s === 'Overnight' ? HC.orangeDark : HC.orange }), borderLeft: s === 'Economy' ? `2px solid ${HC.orangeDark}` : undefined }}>Ship</th>,
                  <th key={`${s}-t`} style={TH({ minWidth: 100, background: s === 'Fast' || s === 'Overnight' ? HC.orangeDark : HC.orange })}>Total</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {filteredList.map((v, i) => {
                const C = i % 2 === 0 ? TD : TDalt;
                const fmt2 = n => n ? Number(n).toFixed(2) : '—';
                const totalPricing = (v.pricing1 || 0) + (v.pricing2 || 0);

                return (
                  <tr key={v.id || i}>
                    <td style={{ ...C(), fontWeight: 800, color: HC.ink2 }}>{v.name || v.vendor_type || '—'}</td>
                    <td style={{ ...C(), fontWeight: 800, color: HC.orange }}>{v.product_type || '—'}</td>
                    <td style={{ ...C(), fontWeight: 800 }}>
                      {v.vendor_type === 'Best Seller' ? (
                        <BestSellerBadge />
                      ) : (
                        v.vendor_type || '—'
                      )}
                    </td>
                    <td style={{ ...C(), fontWeight: 800, color: HC.success, fontSize: 13, background: i % 2 === 0 ? '#ecfdf5' : '#d1fae5' }}>
                      ${totalPricing.toFixed(2)}
                    </td>
                    <td style={C()}>{v.size || '—'}</td>
                    <td style={C()}>{v.optional || '—'}</td>
                    <td style={{ ...C(), borderLeft: `2px solid ${HC.border}`, color: HC.ink2 }}>{fmt2(v.eco_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt2(v.eco_total)}</td>
                    <td style={C()}>{fmt2(v.fast_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt2(v.fast_total)}</td>
                    <td style={C()}>{fmt2(v.express_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt2(v.express_total)}</td>
                    <td style={C()}>{fmt2(v.overnight_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt2(v.overnight_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`
        @keyframes spin360 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
