// ════════════════════════════════════════════════════════
//  VENDORS SECTION — Danh sách vendor
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { vendorApi } from '../../services/api';
import { HC } from '../../constants/sellerTheme';
import { Spinner, EmptyState } from './SellerUI';

function BestSellerBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 999,
      background: 'linear-gradient(135deg,#FFF8DC,#FFE97A)',
      border: '1.5px solid #D4A017',
      color: HC.gold, fontSize: 10, fontWeight: 900,
      fontFamily: "'Nunito',sans-serif", letterSpacing: '0.04em',
    }}>
      ⭐ Best Seller
    </span>
  );
}

export default function VendorsSection() {
  const [vendorList, setVendorList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await vendorApi.list({ per_page: 10000 });
      let list = [];
      if (res.data?.data?.data && Array.isArray(res.data.data.data)) list = res.data.data.data;
      else if (res.data?.data && Array.isArray(res.data.data)) list = res.data.data;
      else if (Array.isArray(res.data)) list = res.data;
      setVendorList(list);
    } catch (err) {
      setApiError(err.response?.data?.message || err.message || 'Lỗi tải dữ liệu');
      setVendorList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);
  useEffect(() => { const t = setInterval(loadVendors, 30000); return () => clearInterval(t); }, [loadVendors]);

  const TH = (extra = {}) => ({ padding: '8px 10px', fontWeight: 900, fontSize: 10, textTransform: 'uppercase', textAlign: 'center', color: '#fff', background: HC.orangeDark, border: `1px solid ${HC.orange}`, ...extra });
  const TD = (extra = {}) => ({ padding: '9px 10px', fontSize: 12, color: HC.ink2, border: `1px solid ${HC.border}`, textAlign: 'center', verticalAlign: 'middle', background: HC.surface2, ...extra });
  const TDalt = (extra = {}) => ({ ...TD(extra), background: HC.orangePale });
  const fmt = n => (n != null && n !== '') ? Number(n).toFixed(2) : '—';

  const Header = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 15 }}>
        Danh sách Vendor
        {!loading && <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 11 }}>{vendorList.length} vendor</span>}
      </div>
    </div>
  );

  if (loading) return <div><Header /><Spinner /></div>;

  return (
    <div>
      <Header />
      {apiError && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {apiError}</span>
          <button onClick={loadVendors} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button>
        </div>
      )}
      <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 12, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, color: HC.brown, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>💡</span>
        <span>Danh sách vendor được quản lý bởi <b>tài khoản Vendor</b>. Trang này chỉ hiển thị để tham khảo.</span>
      </div>
      {vendorList.length === 0 ? (
        <EmptyState msg="Chưa có vendor nào được thêm vào hệ thống" />
      ) : (
        <div style={{ overflowX: 'auto', boxShadow: HC.shadow, borderRadius: 16, border: `1.5px solid ${HC.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...TH(), minWidth: 50 }}>STT</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 72 }}>Hình ảnh</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 140 }}>Vendor Name</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 180 }}>Thông tin tổng quan</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 130 }}>Product Type</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 100, background: HC.orange }}>💰 Pricing</th>
                <th colSpan={2} style={TH()}>Detail</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orange }}>Economy</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orangeDark }}>Fast</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orange }}>Express</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orangeDark }}>Overnight</th>
              </tr>
              <tr>
                {['Size', 'Optional', 'Ship', 'Total', 'Ship', 'Total', 'Ship', 'Total', 'Ship', 'Total'].map((h, i) => (
                  <th key={i} style={TH({ minWidth: h === 'Total' ? 100 : 85 })}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorList.map((v, i) => {
                const C = i % 2 === 0 ? TD : TDalt;
                const totalPricing = (v.pricing1 || 0) + (v.pricing2 || 0);
                return (
                  <tr key={v.id || i}>
                    <td style={{ ...C(), color: HC.muted, fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...C(), verticalAlign: 'middle', padding: '6px' }}>
                      {v.media_url ? (
                        <img src={v.media_url} alt="Vendor" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: `1.5px solid ${HC.border}`, display: 'block' }} />
                      ) : (
                        <div style={{ width: 60, height: 60, borderRadius: 8, background: HC.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: HC.muted, border: `1px dashed ${HC.border}` }}>N/A</div>
                      )}
                    </td>
                    <td style={{ ...C(), fontWeight: 800, color: HC.ink2, verticalAlign: 'middle' }}>
                      {v.name || v.vendor_type || '—'}
                    </td>
                    <td style={{ ...C(), verticalAlign: 'middle', maxWidth: 200 }}>
                      {v.overview ? (
                        <span style={{ fontSize: 11, color: HC.ink2, whiteSpace: 'normal', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={v.overview}>
                          {v.overview}
                        </span>
                      ) : <span style={{ color: HC.muted2, fontStyle: 'italic' }}>—</span>}
                    </td>
                    <td style={{ ...C(), fontWeight: 800, color: HC.orange }}>{v.product_type || '—'}</td>
                    <td style={{ ...C(), fontWeight: 800, color: HC.success, fontSize: 13, background: i % 2 === 0 ? '#ecfdf5' : '#d1fae5' }}>${totalPricing.toFixed(2)}</td>
                    <td style={C()}>{v.size || '—'}</td>
                    <td style={C()}>{v.optional || '—'}</td>
                    <td style={C()}>{fmt(v.eco_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.eco_total)}</td>
                    <td style={C()}>{fmt(v.fast_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.fast_total)}</td>
                    <td style={C()}>{fmt(v.express_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.express_total)}</td>
                    <td style={C()}>{fmt(v.overnight_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.overnight_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
