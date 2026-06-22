// ════════════════════════════════════════════════════════
//  SETUP PRICE SECTION — Grouped by Vendor Name
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { HC } from '../../constants/sellerTheme';
import AppToast from '../shared/AppToast';
import { LS_PRODUCT_VENDORS, LS_SAMPLE_DECISIONS, LS_A_FEEDBACK_RESPONSE } from '../../constants/sellerTheme';
import { lsGet } from '../../utils/sellerHelpers';
import { Pagination } from './SellerUI';
import { inp } from './SellerUI';

const LS_PRICE_KEY = 'STAFF_PRICE_LIST_V3';
const LS_VENDOR_SETUP_KEY = 'VENDOR_PRICE_SETUPS_BY_VENDOR_V1';

// Style helpers
const thBase = { padding: '10px 8px', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'center' };
const thLeft = { ...thBase, textAlign: 'left' };
const tdCenter = { padding: '10px 8px', textAlign: 'center', fontWeight: 600 };
const tdComp = { padding: '6px 7px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 11 };
const inputCell = { ...inp, padding: '5px 7px', fontSize: 11, textAlign: 'right' };

const mkRow = () => ({
  id: Date.now() + Math.random(),
  size_label: '',
  for_adult_kid: '',
  for_type_size: '',
  item_cost: '',
  shipping_cost: '0',
});

const computeRow = (row, g) => {
  const base    = parseFloat(g.gia_hien_thi) || 0;
  const custom  = parseFloat(g.custom_design_price) || 0;
  const ship    = parseFloat(g.ship_price) || 0;
  const cpct    = parseFloat(g.coupon_pct) || 0;
  const ak      = parseFloat(row.for_adult_kid) || 0;
  const ts      = parseFloat(row.for_type_size) || 0;
  const ic      = parseFloat(row.item_cost) || 0;
  const sc      = parseFloat(row.shipping_cost) || 0;

  const total_size   = base + ak + ts;
  const total_price  = total_size + custom + ship;
  const total_cost   = ic + sc;
  const coupon_amt   = cpct / 100 * (total_price - ship);
  const after_price  = total_price - coupon_amt;
  const coupon_fee   = 0.025 * (total_price - ship - coupon_amt);
  const amz_fee      = 0.17 * after_price;
  const profit       = total_price - coupon_amt - coupon_fee - amz_fee - total_cost;
  const profit_ratio  = total_cost > 0 ? profit / total_cost * 100 : 0;
  const profit_margin = total_price > 0 ? profit / total_price * 100 : 0;

  return { ...row, total_size, total_price, total_cost, coupon_amt, after_price, coupon_fee, amz_fee, profit, profit_ratio, profit_margin };
};

export default function SetupPriceSection() {
  const [assignedPriceList, setAssignedPriceList] = useState([]);
  const [search, setSearch]                   = useState('');
  const [filterProductType, setFilterProductType] = useState('');
  const [currentPage, setCurrentPage]         = useState(1);
  const [toast, setToast]                     = useState(null);
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [componentError, setComponentError]   = useState(null);
  const isInitializedRef = useRef(false);
  const ITEMS_PER_PAGE = 10;

  // Modal
  const [showSetupModal, setShowSetupModal]       = useState(false);
  const [selectedGroup, setSelectedGroup]         = useState(null);
  const [globalSettings, setGlobalSettings]       = useState({
    gia_hien_thi: '', custom_design_price: '', ship_price: '', coupon_pct: 10, shipping_method: 'economy'
  });
  const [sizeRows, setSizeRows] = useState([mkRow()]);

  // ── Grouped vendors (by vendor_name) ─────────────────────
  const groupedVendors = useMemo(() => {
    const map = {};
    assignedPriceList.forEach(item => {
      // Group solely by vendor_name so all sizes of same vendor merge into one row
      const key = (item.vendor_name || item.vendor_type || 'unknown').trim();
      if (!map[key]) {
        map[key] = {
          ...item,
          _key: key,
          _rawSizes: [],
          _productTypes: new Set(),
        };
      }
      map[key]._rawSizes.push(item);
      if (item.product_type) map[key]._productTypes.add(item.product_type);
    });
    const allSetups = JSON.parse(localStorage.getItem(LS_VENDOR_SETUP_KEY) || '{}');
    return Object.values(map).map(group => {
      const saved = allSetups[group._key];
      const computedSizes = saved?.sizes?.length
        ? saved.sizes.map(r => computeRow(r, saved))
        : [];
      const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
      // Collect unique size labels from raw data
      const uniqueSizeLabels = [...new Set(group._rawSizes.map(s => s.size).filter(Boolean))];
      return {
        ...group,
        _productTypeList: [...group._productTypes],
        _uniqueSizeLabels: uniqueSizeLabels,
        _saved: saved || null,
        _computedSizes: computedSizes,
        _avgProfit:  avg(computedSizes.map(r => r.profit)),
        _avgMargin:  avg(computedSizes.map(r => r.profit_margin)),
        _minPrice:   computedSizes.length ? Math.min(...computedSizes.map(r => r.total_price)) : null,
        _maxPrice:   computedSizes.length ? Math.max(...computedSizes.map(r => r.total_price)) : null,
      };
    });
  }, [assignedPriceList]);

  const filteredGroups = useMemo(() => groupedVendors.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || (g.vendor_name || '').toLowerCase().includes(q)
      || g._productTypeList.some(pt => pt.toLowerCase().includes(q));
    const matchFilter = !filterProductType
      || g._productTypeList.some(pt => pt.toLowerCase().includes(filterProductType.toLowerCase()));
    return matchSearch && matchFilter;
  }), [groupedVendors, search, filterProductType]);

  // Collect all unique product types across all groups for the filter dropdown
  const productTypes = useMemo(() => {
    const all = groupedVendors.flatMap(g => g._productTypeList);
    return [...new Set(all)].filter(Boolean);
  }, [groupedVendors]);
  const totalPages    = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);
  const pagedGroups   = filteredGroups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Data loading (unchanged logic) ───────────────────────
  const generatePriceListFromApprovedVendors = useCallback((vendors) => {
    if (!vendors || vendors.length === 0) return;
    const savedSetups = JSON.parse(localStorage.getItem('VENDOR_PRICE_SETUPS') || '[]');
    const newPriceList = vendors.map((vendor, idx) => {
      const gia_hien_thi = (parseFloat(vendor.pricing1) || 0) + (parseFloat(vendor.pricing2) || 0);
      const gia_customsize = vendor.size?.trim() ? 5 : 0;
      let gia_ship = parseFloat(vendor.eco_price) || parseFloat(vendor.fast_price) || parseFloat(vendor.express_price) || parseFloat(vendor.overnight_price) || 0;
      const existingSetup = savedSetups.find(s => s.vendor_id === vendor.id && s.product_type === vendor.product_type);
      if (existingSetup) {
        return {
          ...existingSetup,
          eco_price: vendor.eco_price || 0, eco_total: vendor.eco_total || 0,
          fast_price: vendor.fast_price || 0, fast_total: vendor.fast_total || 0,
          express_price: vendor.express_price || 0, express_total: vendor.express_total || 0,
          overnight_price: vendor.overnight_price || 0, overnight_total: vendor.overnight_total || 0,
          pricing1: vendor.pricing1 || 0, pricing2: vendor.pricing2 || 0,
          vendor_name: vendor.name || vendor.vendor_name || vendor.vendor_type,
          vendor_type: vendor.vendor_type, product_type: vendor.product_type,
          size: existingSetup.size || vendor.size,
          gia_hien_thi: existingSetup.total_display_price || gia_hien_thi,
          gia_customsize: existingSetup.total_customize_price || gia_customsize,
          gia_ship: existingSetup.total_ship_min || gia_ship,
          approved_at: vendor.approvedAt, source: 'assigned',
        };
      }
      return {
        id: Date.now() + idx + Math.random(),
        vendor_id: vendor.id, productId: vendor.productId,
        vendor_name: vendor.name || vendor.vendor_name || vendor.vendor_type || 'Unknown',
        vendor_type: vendor.vendor_type || '',
        product_type: vendor.productType || vendor.product_type || '',
        size: vendor.size || '', approved_at: vendor.approvedAt,
        gia_hien_thi, gia_customsize, gia_ship,
        coupon_percent: 0, coupon_fee: 0,
        total_price: gia_hien_thi + gia_customsize + gia_ship,
        profit: 0, profit_margin: 0,
        eco_price: vendor.eco_price || 0, eco_total: vendor.eco_total || 0,
        fast_price: vendor.fast_price || 0, fast_total: vendor.fast_total || 0,
        express_price: vendor.express_price || 0, express_total: vendor.express_total || 0,
        overnight_price: vendor.overnight_price || 0, overnight_total: vendor.overnight_total || 0,
        pricing1: vendor.pricing1 || 0, pricing2: vendor.pricing2 || 0,
        source: 'assigned',
      };
    });
    const unique = newPriceList.filter((item, i, self) =>
      i === self.findIndex(t => String(t.productId) === String(item.productId) && String(t.vendor_id) === String(item.vendor_id) && t.size === item.size)
    );
    setAssignedPriceList(unique);
    if (unique.length > 0) localStorage.setItem(LS_PRICE_KEY, JSON.stringify(unique));
  }, []);

  const loadApprovedVendors = useCallback(() => {
    try {
      const vendors = [];
      const currentProductVendors = lsGet(LS_PRODUCT_VENDORS, {});
      if (typeof currentProductVendors !== 'object' || !currentProductVendors) return;
      const currentAFR = lsGet(LS_A_FEEDBACK_RESPONSE, {});
      Object.entries(currentProductVendors).forEach(([productId, vendorList]) => {
        if (!Array.isArray(vendorList)) return;
        vendorList.forEach((vendor, idx) => {
          if (!vendor) return;
          const key = vendor.id ? String(vendor.id) : `idx_${idx}`;
          vendors.push({
            ...vendor, productId, productType: vendor.product_type,
            approvedAt: currentAFR[productId]?.[key]?.respondedAt || new Date().toISOString(),
            vendorKey: key, source: 'assigned',
          });
        });
      });
      if (vendors.length > 0) { setApprovedVendors(vendors); generatePriceListFromApprovedVendors(vendors); }
      else { setApprovedVendors([]); setAssignedPriceList([]); }
    } catch (err) { console.error('loadApprovedVendors error:', err); setComponentError(err.message); }
  }, [generatePriceListFromApprovedVendors]);

  useEffect(() => {
    if (!isInitializedRef.current) { isInitializedRef.current = true; loadApprovedVendors(); }
    const sync = () => loadApprovedVendors();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [loadApprovedVendors]);

  // ── Modal handlers ────────────────────────────────────────
  const handleOpenSetupModal = (group) => {
    setSelectedGroup(group);
    const saved = group._saved;
    if (saved?.sizes?.length) {
      setGlobalSettings({
        gia_hien_thi: String(saved.gia_hien_thi ?? ''),
        custom_design_price: String(saved.custom_design_price ?? ''),
        ship_price: String(saved.ship_price ?? ''),
        coupon_pct: saved.coupon_pct ?? 10,
        shipping_method: saved.shipping_method || 'economy',
      });
      setSizeRows(saved.sizes.map(s => ({
        id: s.id || Date.now() + Math.random(),
        size_label: s.size_label || '',
        for_adult_kid: s.for_adult_kid ?? '',
        for_type_size: s.for_type_size ?? '',
        item_cost: s.item_cost ?? '',
        shipping_cost: s.shipping_cost ?? '0',
      })));
    } else {
      // Derive default global values from first raw size entry
      const first = group._rawSizes[0] || {};
      const base = (parseFloat(first.pricing1) || 0) + (parseFloat(first.pricing2) || 0);
      const ship = parseFloat(first.eco_price) || parseFloat(first.fast_price) || 0;
      setGlobalSettings({
        gia_hien_thi: base > 0 ? String(base) : '',
        custom_design_price: '',
        ship_price: ship > 0 ? String(ship) : '',
        coupon_pct: 10,
        shipping_method: 'economy',
      });
      // Pre-populate one row per unique size from all raw entries
      // Deduplicate by size label so same size doesn't appear twice
      const seen = new Set();
      const initRows = (group._rawSizes || [])
        .filter(s => {
          const label = (s.size || '').trim();
          if (seen.has(label)) return false;
          seen.add(label);
          return true;
        })
        .map(s => ({
          ...mkRow(),
          size_label: s.size || '',
          item_cost: s.eco_total ? String(parseFloat(s.eco_total) || '') : '',
          shipping_cost: '0',
        }));
      setSizeRows(initRows.length ? initRows : [mkRow()]);
    }
    setShowSetupModal(true);
  };

  const handleSaveSetupPrice = () => {
    const allSetups = JSON.parse(localStorage.getItem(LS_VENDOR_SETUP_KEY) || '{}');
    allSetups[selectedGroup._key] = {
      vendor_id: selectedGroup.vendor_id,
      vendor_name: selectedGroup.vendor_name,
      vendor_type: selectedGroup.vendor_type,
      product_type: selectedGroup.product_type,
      productId: selectedGroup.productId,
      gia_hien_thi: parseFloat(globalSettings.gia_hien_thi) || 0,
      custom_design_price: parseFloat(globalSettings.custom_design_price) || 0,
      ship_price: parseFloat(globalSettings.ship_price) || 0,
      coupon_pct: parseFloat(globalSettings.coupon_pct) || 0,
      shipping_method: globalSettings.shipping_method,
      sizes: sizeRows.map(r => ({
        id: r.id, size_label: r.size_label,
        for_adult_kid: parseFloat(r.for_adult_kid) || 0,
        for_type_size: parseFloat(r.for_type_size) || 0,
        item_cost: parseFloat(r.item_cost) || 0,
        shipping_cost: parseFloat(r.shipping_cost) || 0,
      })),
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(LS_VENDOR_SETUP_KEY, JSON.stringify(allSetups));
    setAssignedPriceList(prev => [...prev]); // trigger groupedVendors recompute
    showToastMsg('success', 'Lưu thành công', `Đã lưu ${sizeRows.length} size cho ${selectedGroup.vendor_name || selectedGroup.vendor_type}`);
    setShowSetupModal(false);
    setSelectedGroup(null);
  };

  const handleDeleteGroup = (group) => {
    const label = group.vendor_name || group.vendor_type || 'Vendor';
    if (!window.confirm(`Xóa "${label}" (${group.product_type || '—'}) khỏi danh sách giá?`)) return;
    const allSetups = JSON.parse(localStorage.getItem(LS_VENDOR_SETUP_KEY) || '{}');
    delete allSetups[group._key];
    localStorage.setItem(LS_VENDOR_SETUP_KEY, JSON.stringify(allSetups));
    const legacy = JSON.parse(localStorage.getItem('VENDOR_PRICE_SETUPS') || '[]');
    localStorage.setItem('VENDOR_PRICE_SETUPS', JSON.stringify(legacy.filter(s => !(String(s.vendor_id) === String(group.vendor_id) && s.product_type === group.product_type))));
    setAssignedPriceList(prev => prev.filter(p => !(String(p.vendor_id) === String(group.vendor_id) && p.product_type === group.product_type)));
    showToastMsg('success', 'Đã xóa', `Đã xóa "${label}"`);
  };

  const updateRow = (idx, field, val) => setSizeRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  const addRow    = () => setSizeRows(prev => [...prev, mkRow()]);
  const removeRow = (idx) => setSizeRows(prev => prev.filter((_, i) => i !== idx));

  const showToastMsg = (type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  };

  if (componentError) return (
    <div style={{ padding: 40, textAlign: 'center', color: HC.danger }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
      <div style={{ fontWeight: 700 }}>Có lỗi xảy ra</div>
      <div style={{ fontSize: 13, marginTop: 8, color: HC.muted }}>{componentError}</div>
      <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: '8px 20px', borderRadius: 8, background: HC.orange, color: '#fff', border: 'none', cursor: 'pointer' }}>Tải lại trang</button>
    </div>
  );

  const computedRows = sizeRows.map(r => computeRow(r, globalSettings));
  const gBase   = parseFloat(globalSettings.gia_hien_thi) || 0;
  const gCustom = parseFloat(globalSettings.custom_design_price) || 0;
  const gShip   = parseFloat(globalSettings.ship_price) || 0;
  const gCpct   = parseFloat(globalSettings.coupon_pct) || 0;

  return (
    <div>
      <AppToast toast={toast} onClose={() => setToast(null)} />

      {/* ── Main grouped table ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 6, height: 24, borderRadius: 99, background: `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink }}>Vendor từ Uyên Hồ gán</div>
          <span style={{ padding: '2px 10px', borderRadius: 20, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11, fontWeight: 700 }}>{filteredGroups.length} vendor</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Tìm vendor / product..." value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface, color: HC.ink, outline: 'none', width: 200 }} />
            <select value={filterProductType} onChange={e => { setFilterProductType(e.target.value); setCurrentPage(1); }}
              style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface, color: filterProductType ? HC.orangeDark : HC.muted, outline: 'none', cursor: 'pointer' }}>
              <option value="">Tất cả Product Type</option>
              {productTypes.map(pt => <option key={pt} value={pt}>{pt}</option>)}
            </select>
            {(search || filterProductType) && (
              <button onClick={() => { setSearch(''); setFilterProductType(''); setCurrentPage(1); }}
                style={{ padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, background: HC.surface, color: HC.muted, fontSize: 12, cursor: 'pointer' }}>
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: HC.surface, borderRadius: 12, border: `1px solid ${HC.border}` }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🏪</div>
            <div style={{ fontWeight: 600, color: HC.muted }}>Chưa có vendor nào được gán và duyệt</div>
          </div>
        ) : (
          <>
            <div style={{ borderRadius: 14, border: `1.5px solid ${HC.border}`, background: HC.surface, boxShadow: `0 4px 12px rgba(0,0,0,0.05)`, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})` }}>
                    <th style={thBase}>STT</th>
                    <th style={thLeft}>Vendor Name</th>
                    <th style={thLeft}>Vendor Type</th>
                    <th style={thLeft}>Product Type</th>
                    <th style={thBase}>Số Size</th>
                    <th style={thBase}>Price Range</th>
                    <th style={thBase}>Avg Profit</th>
                    <th style={thBase}>Avg Margin</th>
                    <th style={{ ...thBase, minWidth: 130 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedGroups.map((group, idx) => (
                    <tr key={group._key} style={{ borderBottom: `1px solid ${HC.border}`, background: idx % 2 === 0 ? '#fff' : HC.surface2 }}>
                      <td style={tdCenter}>{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: HC.ink2 }}>{group.vendor_name || '—'}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600, color: group.vendor_type === 'Best Seller' ? '#D4A017' : HC.orange }}>
                        {group.vendor_type || '—'}{group.vendor_type === 'Best Seller' && <span style={{ marginLeft: 4, fontSize: 11 }}>⭐</span>}
                      </td>
                      {/* Product Types — all types across the group */}
                      <td style={{ padding: '8px 8px', maxWidth: 160 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {group._productTypeList.length > 0
                            ? group._productTypeList.map(pt => (
                                <span key={pt} style={{ padding: '2px 7px', borderRadius: 10, background: HC.surface2, border: `1px solid ${HC.border}`, fontSize: 10, fontWeight: 600, color: HC.ink2, whiteSpace: 'nowrap' }}>{pt}</span>
                              ))
                            : <span style={{ color: HC.muted, fontSize: 11 }}>—</span>}
                        </div>
                      </td>
                      {/* Số Size — count of unique sizes from raw data + setup badge */}
                      <td style={tdCenter}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, background: HC.orangeLight, color: HC.orangeDark, fontWeight: 700, fontSize: 11 }}>
                            {group._rawSizes.length} size
                          </span>
                          {group._computedSizes.length > 0
                            ? <span style={{ fontSize: 10, color: HC.success, fontWeight: 600 }}>✓ Đã setup</span>
                            : <span style={{ fontSize: 10, color: HC.muted }}>Chưa setup</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: HC.ink2 }}>
                        {group._minPrice != null
                          ? (group._minPrice === group._maxPrice ? `$${group._minPrice.toFixed(2)}` : `$${group._minPrice.toFixed(2)} – $${group._maxPrice.toFixed(2)}`)
                          : <span style={{ color: HC.muted, fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: group._avgProfit != null ? (group._avgProfit > 0 ? HC.success : HC.danger) : HC.muted }}>
                        {group._avgProfit != null ? `$${group._avgProfit.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: group._avgMargin != null ? (group._avgMargin > 20 ? HC.success : HC.warning) : HC.muted }}>
                        {group._avgMargin != null ? `${group._avgMargin.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => handleOpenSetupModal(group)}
                            style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            Setup giá
                          </button>
                          <button onClick={() => handleDeleteGroup(group)}
                            style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#fef2f2', color: HC.danger, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredGroups.length} onPageChange={setCurrentPage} itemsPerPage={ITEMS_PER_PAGE} />
            )}
          </>
        )}
      </div>

      {/* ── Setup Modal ── */}
      {showSetupModal && selectedGroup && (
        <div onClick={() => setShowSetupModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(3px)', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '98vw', maxWidth: 1500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: HC.surface, borderRadius: 20, boxShadow: HC.shadowStrong, overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '14px 24px', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>⚙️ Setup Giá Bán — {selectedGroup.vendor_name || selectedGroup.vendor_type}</div>
                  <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>{selectedGroup.vendor_type}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>{selectedGroup._rawSizes.length} size</span>
                    {selectedGroup._productTypeList.length > 0 && (
                      <>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>Products: {selectedGroup._productTypeList.join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={() => setShowSetupModal(false)}
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            </div>

            {/* Global Settings */}
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${HC.border}`, background: HC.surface2, flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: HC.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>⚙️ Cài đặt chung — áp dụng cho tất cả size</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                {[
                  { label: '💰 Giá hiển thị cơ bản ($)', key: 'gia_hien_thi', placeholder: '7.99' },
                  { label: '🎨 Custom Design Push ($)', key: 'custom_design_price', placeholder: '14.99' },
                  { label: '🚚 Ship Price ($)', key: 'ship_price', placeholder: '7.99' },
                  { label: '🎫 Coupon (%)', key: 'coupon_pct', placeholder: '10' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: HC.muted, display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type="number" step="0.01" placeholder={placeholder} value={globalSettings[key]}
                      onChange={e => setGlobalSettings(p => ({ ...p, [key]: e.target.value }))}
                      style={{ ...inp, padding: '8px 10px', fontSize: 12 }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: HC.muted, display: 'block', marginBottom: 4 }}>📦 Phương thức vận chuyển</label>
                  <select value={globalSettings.shipping_method}
                    onChange={e => setGlobalSettings(p => ({ ...p, shipping_method: e.target.value }))}
                    style={{ ...inp, padding: '8px 10px', fontSize: 12, cursor: 'pointer' }}>
                    <option value="economy">🚚 Economy</option>
                    <option value="fast">⚡ Ground/Fast</option>
                    <option value="express">✈️ Express</option>
                    <option value="overnight">🌙 Overnight</option>
                  </select>
                </div>
              </div>
              {/* Preview formula */}
              <div style={{ marginTop: 10, padding: '8px 14px', background: HC.orangeLight, borderRadius: 8, border: `1px solid ${HC.orangeMid}`, fontSize: 11, color: HC.orangeDark, fontWeight: 600 }}>
                💡 Công thức: Total Price = Giá hiển thị + For Adult/Kid + For Type+Size + Custom Push + Ship &nbsp;|&nbsp; Base = ${gBase.toFixed(2)}, Custom = ${gCustom.toFixed(2)}, Ship = ${gShip.toFixed(2)}, Coupon = {gCpct}%
              </div>
            </div>

            {/* Size Table */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 24px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: HC.ink }}>
                  📊 Bảng tính giá theo Size
                  <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11 }}>{sizeRows.length} size</span>
                </div>
                <button onClick={addRow}
                  style={{ padding: '7px 16px', borderRadius: 8, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  + Thêm Size
                </button>
              </div>

              <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '0 24px 12px' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 1350, width: '100%' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    {/* Group headers */}
                    <tr>
                      <th colSpan={5} style={{ padding: '6px 8px', background: `${HC.orange}22`, color: HC.orangeDark, fontWeight: 800, fontSize: 11, textAlign: 'center', border: `1px solid ${HC.orangeMid}`, borderBottom: 'none' }}>
                        ✏️ Nhập liệu
                      </th>
                      <th style={{ width: 8, background: 'transparent', border: 'none' }} />
                      <th colSpan={11} style={{ padding: '6px 8px', background: '#f0fdf4', color: '#065f46', fontWeight: 800, fontSize: 11, textAlign: 'center', border: '1px solid #bbf7d0', borderBottom: 'none' }}>
                        📐 Tính toán tự động
                      </th>
                      <th style={{ background: 'transparent', border: 'none' }} />
                    </tr>
                    {/* Column headers */}
                    <tr style={{ background: HC.surface2 }}>
                      {/* Input cols */}
                      <th style={{ ...thBase, background: HC.orangeDark, color: '#fff', border: `1px solid ${HC.orangeMid}`, minWidth: 90, fontSize: 11 }}>Size</th>
                      <th style={{ ...thBase, background: HC.orangeDark, color: '#fff', border: `1px solid ${HC.orangeMid}`, minWidth: 80, fontSize: 11 }}>For Adult/Kid ($)</th>
                      <th style={{ ...thBase, background: HC.orangeDark, color: '#fff', border: `1px solid ${HC.orangeMid}`, minWidth: 80, fontSize: 11 }}>For Type+Size ($)</th>
                      <th style={{ ...thBase, background: HC.orangeDark, color: '#fff', border: `1px solid ${HC.orangeMid}`, minWidth: 80, fontSize: 11 }}>Item Cost ($)</th>
                      <th style={{ ...thBase, background: HC.orangeDark, color: '#fff', border: `1px solid ${HC.orangeMid}`, minWidth: 80, fontSize: 11 }}>Ship Cost ($)</th>
                      {/* Separator */}
                      <th style={{ width: 8, background: HC.border, border: 'none' }} />
                      {/* Computed cols */}
                      {[
                        'Total Size ($)', 'Custom Push ($)', 'Ship Price ($)', 'Total Price ($)',
                        'Total Cost ($)', `Coupon (${gCpct}%)`, 'Coupon Fee', 'AMZ Fee (17%)',
                        'Profit ($)', '% Profit/Cost', 'Profit Margin',
                      ].map(h => (
                        <th key={h} style={{ padding: '8px 7px', background: '#ecfdf5', color: '#065f46', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', border: '1px solid #bbf7d0', fontSize: 11, minWidth: h === 'Total Price ($)' ? 85 : 72 }}>
                          {h}
                        </th>
                      ))}
                      <th style={{ padding: '8px 6px', background: HC.surface2, color: HC.muted, fontWeight: 700, textAlign: 'center', border: `1px solid ${HC.border}`, width: 40 }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedRows.map((row, idx) => (
                      <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                        {/* Size label */}
                        <td style={{ padding: '5px 5px', border: `1px solid ${HC.border}` }}>
                          <input type="text" value={row.size_label} onChange={e => updateRow(idx, 'size_label', e.target.value)}
                            placeholder="Men S" style={{ ...inputCell, width: 78, textAlign: 'left' }} />
                        </td>
                        {/* For Adult/Kid */}
                        <td style={{ padding: '5px 5px', border: `1px solid ${HC.border}` }}>
                          <input type="number" step="0.01" value={row.for_adult_kid} onChange={e => updateRow(idx, 'for_adult_kid', e.target.value)}
                            placeholder="0" style={{ ...inputCell, width: 68 }} />
                        </td>
                        {/* For Type+Size */}
                        <td style={{ padding: '5px 5px', border: `1px solid ${HC.border}` }}>
                          <input type="number" step="0.01" value={row.for_type_size} onChange={e => updateRow(idx, 'for_type_size', e.target.value)}
                            placeholder="0" style={{ ...inputCell, width: 68 }} />
                        </td>
                        {/* Item Cost */}
                        <td style={{ padding: '5px 5px', border: `1px solid ${HC.border}` }}>
                          <input type="number" step="0.01" value={row.item_cost} onChange={e => updateRow(idx, 'item_cost', e.target.value)}
                            placeholder="0" style={{ ...inputCell, width: 68 }} />
                        </td>
                        {/* Ship Cost */}
                        <td style={{ padding: '5px 5px', border: `1px solid ${HC.border}` }}>
                          <input type="number" step="0.01" value={row.shipping_cost} onChange={e => updateRow(idx, 'shipping_cost', e.target.value)}
                            placeholder="0" style={{ ...inputCell, width: 68 }} />
                        </td>
                        {/* Separator */}
                        <td style={{ width: 8, background: HC.border, padding: 0 }} />
                        {/* Total Size */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', color: HC.orangeDark }}>${row.total_size.toFixed(2)}</td>
                        {/* Custom Push (from global) */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', color: HC.muted }}>${gCustom.toFixed(2)}</td>
                        {/* Ship Price (from global) */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', color: HC.muted }}>${gShip.toFixed(2)}</td>
                        {/* Total Price */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', fontWeight: 800, fontSize: 12, color: HC.success, background: '#f0fdf4' }}>${row.total_price.toFixed(2)}</td>
                        {/* Total Cost */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0' }}>${row.total_cost.toFixed(2)}</td>
                        {/* Coupon */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', color: HC.warning }}>-${row.coupon_amt.toFixed(3)}</td>
                        {/* Coupon Fee */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', color: '#d97706' }}>${row.coupon_fee.toFixed(5)}</td>
                        {/* AMZ Fee */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', color: HC.orangeDark }}>${row.amz_fee.toFixed(4)}</td>
                        {/* Profit */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', fontWeight: 800, fontSize: 12, color: row.profit > 0 ? HC.success : HC.danger }}>${row.profit.toFixed(1)}</td>
                        {/* Profit Ratio */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', color: row.profit_ratio > 40 ? HC.success : HC.warning }}>{row.profit_ratio.toFixed(2)}%</td>
                        {/* Profit Margin */}
                        <td style={{ ...tdComp, border: '1px solid #bbf7d0', color: row.profit_margin > 20 ? HC.success : HC.warning }}>{row.profit_margin.toFixed(2)}%</td>
                        {/* Delete */}
                        <td style={{ padding: '5px 4px', textAlign: 'center', border: `1px solid ${HC.border}` }}>
                          <button onClick={() => removeRow(idx)} disabled={sizeRows.length <= 1}
                            style={{ width: 26, height: 26, borderRadius: 6, background: sizeRows.length <= 1 ? HC.surface2 : '#fee2e2', border: '1px solid #fecaca', color: sizeRows.length <= 1 ? HC.muted : HC.danger, cursor: sizeRows.length <= 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${HC.border}`, display: 'flex', gap: 12, justifyContent: 'flex-end', background: HC.surface2, flexShrink: 0 }}>
              <button onClick={() => setShowSetupModal(false)}
                style={{ padding: '10px 20px', borderRadius: 10, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer', fontWeight: 700 }}>
                Hủy
              </button>
              <button onClick={handleSaveSetupPrice}
                style={{ padding: '10px 28px', borderRadius: 10, background: `linear-gradient(135deg,${HC.success},#15803d)`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                💾 Lưu Setup Giá
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
