// ════════════════════════════════════════════════════════
//  SETUP PRICE SECTION
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';
import { HC } from '../../constants/sellerTheme';
import { LS_PRODUCT_VENDORS, LS_SAMPLE_DECISIONS, LS_A_FEEDBACK_RESPONSE } from '../../constants/sellerTheme';
import { lsGet } from '../../utils/sellerHelpers';
import { Pagination } from './SellerUI';
import { inp } from './SellerUI';
import { SearchOutlined } from '@ant-design/icons';

export default function SetupPriceSection() {
  const LS_PRICE_KEY = 'STAFF_PRICE_LIST_V3';

  const [assignedPriceList, setAssignedPriceList] = useState([]);
  const [search, setSearch] = useState('');
  const [filterProductType, setFilterProductType] = useState('');
  const [currentPageAssigned, setCurrentPageAssigned] = useState(1);
  const ITEMS_PER_PAGE_PRICE = 10;
  const [toast, setToast] = useState(null);
  const selectedIndexRef = useRef(-1);
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [productVendors, setProductVendors] = useState(() => lsGet(LS_PRODUCT_VENDORS, {}));
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [componentError, setComponentError] = useState(null);

  // State so sánh
  const [comparisonList, setComparisonList] = useState([]);

  // State cho nhiều giá trị
  const [displayPrices, setDisplayPrices] = useState([0]);
  const [customizePrices, setCustomizePrices] = useState([{ name: '', price: 0 }]);
  const [shipPrices, setShipPrices] = useState([{ name: '', price: 0 }]);

  const [setupForm, setSetupForm] = useState({
    shipping_method: 'economy',
    size: '',
    final_price: 0,
    profit: 0,
    profit_margin: 0,
    coupon_percent: 10,
    coupon_amount: 0,
    coupon_fee: 0,
    amz_fee: 0
  });

  // Thông tin ship price và total price theo phương thức
  const [shipInfo, setShipInfo] = useState({
    ship_price: 0,
    total_price: 0
  });

  // Hàm thêm giá trị mới
  const addPriceField = (type) => {
    switch (type) {
      case 'display':
        setDisplayPrices([...displayPrices, 0]);
        break;
      case 'customize':
        setCustomizePrices([...customizePrices, { name: '', price: 0 }]);
        break;
      case 'ship':
        setShipPrices([...shipPrices, { name: '', price: 0 }]);
        break;
      default:
        break;
    }
  };

  // Hàm xóa giá trị
  const removePriceField = (type, index) => {
    switch (type) {
      case 'display':
        if (displayPrices.length > 1) {
          const newPrices = [...displayPrices];
          newPrices.splice(index, 1);
          setDisplayPrices(newPrices);
        }
        break;
      case 'customize':
        if (customizePrices.length > 1) {
          const newPrices = [...customizePrices];
          newPrices.splice(index, 1);
          setCustomizePrices(newPrices);
        }
        break;
      case 'ship':
        if (shipPrices.length > 1) {
          const newPrices = [...shipPrices];
          newPrices.splice(index, 1);
          setShipPrices(newPrices);
        }
        break;
      default:
        break;
    }
  };

  // Hàm cập nhật giá trị
  const updatePriceField = (type, index, value) => {
    switch (type) {
      case 'display':
        const newDisplayPrices = [...displayPrices];
        newDisplayPrices[index] = parseFloat(value) || 0;
        setDisplayPrices(newDisplayPrices);
        break;
      case 'customize':
        const newCustomizePrices = [...customizePrices];
        newCustomizePrices[index].price = parseFloat(value) || 0;
        setCustomizePrices(newCustomizePrices);
        break;
      case 'ship':
        const newShipPrices = [...shipPrices];
        newShipPrices[index].price = parseFloat(value) || 0;
        setShipPrices(newShipPrices);
        break;
      default:
        break;
    }
  };

  const updatePriceName = (type, index, value) => {
    if (type === 'customize') {
      const newCustomizePrices = [...customizePrices];
      newCustomizePrices[index].name = value;
      setCustomizePrices(newCustomizePrices);
    } else if (type === 'ship') {
      const newShipPrices = [...shipPrices];
      newShipPrices[index].name = value;
      setShipPrices(newShipPrices);
    }
  };

  // Tính tổng các giá trị
  const getTotalDisplayPrice = () => {
    return displayPrices.reduce((sum, price) => sum + price, 0);
  };

  const getTotalCustomizePrice = () => {
    return customizePrices.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  };

  const getTotalShipMin = () => {
    return shipPrices.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  };

  const [sampleDecisions, setSampleDecisions] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_SAMPLE_DECISIONS);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [aFeedbackResponses, setAFeedbackResponses] = useState(() => lsGet(LS_A_FEEDBACK_RESPONSE, {}));

  const isInitializedRef = useRef(false);

  // Hàm lấy ship price và total price theo phương thức
  const getShipInfoByMethod = (vendor, method) => {
    switch (method) {
      case 'economy':
        return { ship_price: vendor?.eco_price || 0, total_price: vendor?.eco_total || 0 };
      case 'fast':
        return { ship_price: vendor?.fast_price || 0, total_price: vendor?.fast_total || 0 };
      case 'express':
        return { ship_price: vendor?.express_price || 0, total_price: vendor?.express_total || 0 };
      case 'overnight':
        return { ship_price: vendor?.overnight_price || 0, total_price: vendor?.overnight_total || 0 };
      default:
        return { ship_price: vendor?.eco_price || 0, total_price: vendor?.eco_total || 0 };
    }
  };

  // Hàm mở modal setup giá
  const handleOpenSetupModal = (vendor) => {
    const foundIndex = assignedPriceList.findIndex(
      item => item.id === vendor.id ||
        (item.product_type === vendor.product_type && item.vendor_type === vendor.vendor_type)
    );
    selectedIndexRef.current = foundIndex;
    const gia_hien_thi = vendor.gia_hien_thi ?? ((vendor.pricing1 || 0) + (vendor.pricing2 || 0));
    const total_customize_price = vendor.gia_customsize !== undefined
      ? vendor.gia_customsize
      : (vendor.size && vendor.size.trim() !== '' ? 5 : 0);

    const defaultMethod = vendor.shipping_method || 'economy';
    const defaultShipInfo = getShipInfoByMethod(vendor, defaultMethod);
    const initShipPrice = vendor.ship_prices
      ? vendor.ship_prices[0]
      : (vendor.gia_ship !== undefined ? vendor.gia_ship : defaultShipInfo.ship_price);

    setSelectedVendor(vendor);
    setShipInfo(defaultShipInfo);
    setDisplayPrices(vendor.display_prices || [gia_hien_thi]);
    
    setCustomizePrices(vendor.customize_prices?.length 
      ? vendor.customize_prices.map(p => typeof p === 'object' ? p : { name: '', price: p }) 
      : [{ name: '', price: total_customize_price }]);
      
    setShipPrices(vendor.ship_prices?.length 
      ? vendor.ship_prices.map(p => typeof p === 'object' ? p : { name: getShippingMethodLabel(defaultMethod), price: p }) 
      : [{ name: '', price: 0 }]);
    setSetupForm({
      shipping_method: defaultMethod,
      size: vendor.size || '',
      final_price: vendor.final_price || 0,
      profit: vendor.profit || 0,
      profit_margin: vendor.profit_margin || 0,
      coupon_percent: vendor.coupon_percent || 0,
      coupon_amount: vendor.coupon_amount || 0,
      coupon_fee: vendor.coupon_fee || 0,
      amz_fee: vendor.amz_fee || 0,
    });
    setComparisonList([]);
    setShowSetupModal(true);
  };

  // Hàm xóa vendor khỏi danh sách giá
  const handleDeletePriceSetup = (vendor) => {
    const label = vendor.vendor_name || vendor.vendor_type || 'Vendor';
    if (window.confirm(`Xóa "${label}" (${vendor.product_type || '—'}) khỏi danh sách giá?`)) {
      // Xóa khỏi VENDOR_PRICE_SETUPS
      const savedSetups = JSON.parse(localStorage.getItem('VENDOR_PRICE_SETUPS') || '[]');
      localStorage.setItem('VENDOR_PRICE_SETUPS', JSON.stringify(
        savedSetups.filter(s => !(s.vendor_id === vendor.vendor_id && s.product_type === vendor.product_type))
      ));

      // Xóa khỏi LS_PRODUCT_VENDORS để không bị tái tạo lại
      if (vendor.productId && vendor.vendorKey !== undefined) {
        const allPV = lsGet(LS_PRODUCT_VENDORS, {});
        if (Array.isArray(allPV[vendor.productId])) {
          allPV[vendor.productId] = allPV[vendor.productId].filter((v, i) => {
            const k = v.id ? String(v.id) : `idx_${i}`;
            return k !== String(vendor.vendorKey);
          });
          lsSet(LS_PRODUCT_VENDORS, allPV);
          window.dispatchEvent(new StorageEvent('storage', { key: LS_PRODUCT_VENDORS }));
        }
      }

      // Cập nhật state trực tiếp
      setAssignedPriceList(prev => prev.filter(p =>
        !(p.vendor_id === vendor.vendor_id && p.product_type === vendor.product_type)
      ));

      showToastMsg('success', '🗑 Đã xóa', `Đã xóa "${label}" khỏi danh sách giá`);
    }
  };

  // Hàm tính toán lại giá khi thay đổi
  const calculateSetupPrices = useCallback(() => {
    if (!selectedVendor || selectedIndexRef.current === -1) return;

    const total_display = getTotalDisplayPrice();
    const total_customize = getTotalCustomizePrice();
    const total_ship = getTotalShipMin();

    // Total price (1) = Total Giá hiển thị + Total Giá Customsize + Total Giá Ship
    const total_price_1 = total_display + total_customize + total_ship;

    // Total Price (2) là của Phương thức vận chuyển đã chọn (shipInfo.total_price)
    const total_price_2 = shipInfo.total_price || 0;

    const coupon_pct = setupForm.coupon_percent || 0;

    // Coupon = %Coupon × (Total price (1) - Total Giá Ship)
    const coupon_amount = coupon_pct * (total_price_1 - total_ship) / 100;

    // After price = Total Price (1) - Coupon
    const after_price = total_price_1 - coupon_amount;

    // Coupon Fee (2.5%) = 2.5% × (Total Price(1) - Total Giá Ship - Coupon)
    const coupon_fee = 0.025 * (total_price_1 - total_ship - coupon_amount);

    // AMZ fee = 17% × After price
    const amz_fee = after_price * 0.17;

    // Base Cost = Total Price (2)
    const base_cost = total_price_2;

    // Profit = Total Price (1) - Coupon - Coupon Fee - AMZ fee - Base cost
    const profit = total_price_1 - coupon_amount - coupon_fee - amz_fee - base_cost;

    // Profit Margin = Profit / Total Price (1)
    const profit_margin = total_price_1 > 0 ? (profit / total_price_1) * 100 : 0;

    // Cập nhật modal
    setSetupForm(prev => ({
      ...prev,
      final_price: total_price_1,
      coupon_amount: coupon_amount,
      coupon_fee: coupon_fee,
      amz_fee: amz_fee,
      profit: profit,
      profit_margin: profit_margin,
    }));

    // Cập nhật assignedPriceList
    setAssignedPriceList(prev => prev.map((item, index) => {
      if (index !== selectedIndexRef.current) return item;
      return {
        ...item,
        gia_hien_thi: total_display,
        gia_customsize: total_customize,
        gia_ship: total_ship,
        total_price_2: total_price_2,
        coupon_percent: coupon_pct,
        coupon_amount: coupon_amount,
        coupon_fee: coupon_fee,
        amz_fee: amz_fee,
        profit: profit,
        profit_margin: profit_margin,
        after_price: after_price,
        final_price: total_price_1,
      };
    }));

  }, [selectedVendor, displayPrices, customizePrices, shipPrices, setupForm.coupon_percent, shipInfo.total_price]);
  // Hàm xử lý thay đổi shipping method
  const handleShippingMethodChange = (method) => {
    const newShipInfo = getShipInfoByMethod(selectedVendor, method);
    setShipInfo(newShipInfo);
    setSetupForm(prev => ({
      ...prev,
      shipping_method: method
    }));
  };

  const handleAddComparison = () => {
    setComparisonList(prev => [...prev, {
      id: Date.now(),
      shipping_method_label: getShippingMethodLabel(setupForm.shipping_method),
      coupon_percent: setupForm.coupon_percent,
      profit: setupForm.profit,
      profit_margin: setupForm.profit_margin,
      profit_fulfill: shipInfo.total_price ? (setupForm.profit / shipInfo.total_price * 100) : 0,
      total_price_1: setupForm.final_price,
    }]);
  };

  const handleRemoveComparison = (id) => {
    setComparisonList(prev => prev.filter(c => c.id !== id));
  };

  // Hàm lưu setup giá
  const handleSaveSetupPrice = () => {
    const total_display = getTotalDisplayPrice();
    const total_customize = getTotalCustomizePrice();
    const total_ship = getTotalShipMin();

    // Total price (1) = Tổng giá hiển thị + Tổng Customize + Tổng Ship
    const total_price_1 = total_display + total_customize + total_ship;

    // Total Price (2) là của Phương thức vận chuyển đã chọn
    const total_price_2 = shipInfo.total_price || 0;

    const coupon_pct = setupForm.coupon_percent || 0;

    // Coupon = %Coupon × (Total price (1) - Tổng Ship)
    const coupon_amount = coupon_pct * (total_price_1 - total_ship) / 100;

    // After price = Total Price (1) - Coupon
    const after_price = total_price_1 - coupon_amount;

    // Coupon Fee (2.5%) = 2.5% × (Total Price(1) - Tổng Ship - Coupon)
    // = 2.5% × (Tổng giá hiển thị + Tổng Customize - Coupon)
    const coupon_fee_val = 0.025 * (total_price_1 - total_ship - coupon_amount);

    // AMZ fee = 17% × After price
    const amz_fee_val = after_price * 0.17;

    // Base Cost = Total Price (2)
    const base_cost_val = total_price_2;

    // Profit = Total Price (1) - Coupon - Coupon Fee - AMZ fee - Base cost
    const profit_val = total_price_1 - coupon_amount - coupon_fee_val - amz_fee_val - base_cost_val;

    // Profit Margin = Profit / Total Price (1)
    const profit_margin_val = total_price_1 > 0 ? (profit_val / total_price_1) * 100 : 0;

    const savedData = {
      id: Date.now(),
      vendor_id: selectedVendor?.vendor_id,
      vendor_name: selectedVendor?.vendor_name || selectedVendor?.vendor_type,
      vendor_type: selectedVendor?.vendor_type,
      product_type: selectedVendor?.product_type,
      original_size: selectedVendor?.size,
      shipping_method: setupForm.shipping_method,
      shipping_method_label: getShippingMethodLabel(setupForm.shipping_method),
      ship_price: shipInfo.ship_price,
      ship_total: total_price_2,  // Total Price (2)
      display_prices: [...displayPrices],
      customize_prices: [...customizePrices],
      ship_prices: [...shipPrices],
      total_display_price: total_display,
      total_customize_price: total_customize,
      total_ship_min: total_ship,
      total_price_1: total_price_1,
      total_price_2: total_price_2,
      size: setupForm.size,
      final_price: total_price_1,
      coupon_percent: coupon_pct,
      coupon_amount: coupon_amount,
      coupon_fee: coupon_fee_val,
      amz_fee: amz_fee_val,
      profit: profit_val,
      profit_margin: profit_margin_val,
      after_price: after_price,
      base_cost: base_cost_val,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Lưu localStorage
    let savedSetups = JSON.parse(localStorage.getItem('VENDOR_PRICE_SETUPS') || '[]');
    const existingIndex = savedSetups.findIndex(
      s => s.vendor_id === selectedVendor?.vendor_id && s.product_type === selectedVendor?.product_type
    );
    if (existingIndex !== -1) {
      savedSetups[existingIndex] = savedData;
    } else {
      savedSetups.push(savedData);
    }
    localStorage.setItem('VENDOR_PRICE_SETUPS', JSON.stringify(savedSetups));

    // Cập nhật state bảng chính
    setAssignedPriceList(prev => prev.map(item => {
      if (item.vendor_id === selectedVendor?.vendor_id && item.product_type === selectedVendor?.product_type) {
        return {
          ...item,
          ...savedData,
          gia_hien_thi: total_display,
          gia_customsize: total_customize,
          gia_ship: total_ship,
        };
      }
      return item;
    }));

    showToastMsg('success', '✅ Lưu thành công', `Đã lưu cấu hình giá cho ${selectedVendor?.vendor_type || 'vendor'}`);
    setShowSetupModal(false);
    setSelectedVendor(null);
    setDisplayPrices([0]);
    setCustomizePrices([0]);
    setShipPrices([0]);
    selectedIndexRef.current = -1;
  };

  const getShippingMethodLabel = (method) => {
    switch (method) {
      case 'economy': return 'Economy (Chậm)';
      case 'fast': return 'Ground/Fast (TB)';
      case 'express': return 'Express (Nhanh)';
      case 'overnight': return 'Overnight (Qua đêm)';
      default: return 'Economy';
    }
  };

  const generatePriceListFromApprovedVendors = useCallback((vendors) => {
    if (!vendors || vendors.length === 0) return;

    const savedSetups = JSON.parse(localStorage.getItem('VENDOR_PRICE_SETUPS') || '[]');

    const newPriceList = vendors.map((vendor, idx) => {
      const gia_hien_thi = (parseFloat(vendor.pricing1) || 0) + (parseFloat(vendor.pricing2) || 0);
      const gia_customsize = vendor.size && vendor.size.trim() !== '' ? 5 : 0;

      let gia_ship = 0;
      if (vendor.eco_price && parseFloat(vendor.eco_price) > 0) gia_ship = parseFloat(vendor.eco_price);
      else if (vendor.fast_price && parseFloat(vendor.fast_price) > 0) gia_ship = parseFloat(vendor.fast_price);
      else if (vendor.express_price && parseFloat(vendor.express_price) > 0) gia_ship = parseFloat(vendor.express_price);
      else if (vendor.overnight_price && parseFloat(vendor.overnight_price) > 0) gia_ship = parseFloat(vendor.overnight_price);

      let default_coupon_pct = 0;
      if (vendor.vendor_type === 'Best Seller') default_coupon_pct = 10;
      else if (vendor.vendor_type === 'New') default_coupon_pct = 5;
      else if (vendor.vendor_type === 'Old') default_coupon_pct = 3;

      const existingSetup = savedSetups.find(s => s.vendor_id === vendor.id && s.product_type === vendor.product_type);

      if (existingSetup) {
        const ed = existingSetup.total_display_price ?? gia_hien_thi;
        const ec = existingSetup.total_customize_price ?? gia_customsize;
        const es = existingSetup.total_ship_min ?? gia_ship;
        const ep = existingSetup.coupon_percent ?? default_coupon_pct;  // ✅ Lấy % đã lưu
        const e_coupon_val = ep * (ed + ec) / 100;
        const e_after = (ed + ec + es) - e_coupon_val;
        const e_coupon_fee = existingSetup.coupon_fee ?? (0.025 * (ed + ec + es - es - e_coupon_val));
        const e_amz = existingSetup.amz_fee ?? (e_after * 0.17);
        const e_profit = existingSetup.profit ?? (e_after - e_coupon_fee - e_amz - e_after * 0.4);
        const e_margin = existingSetup.profit_margin ?? ((ed + ec + es) > 0 ? (e_profit / (ed + ec + es)) * 100 : 0);

        return {
          ...existingSetup,
          eco_price: vendor.eco_price || 0, eco_total: vendor.eco_total || 0,
          fast_price: vendor.fast_price || 0, fast_total: vendor.fast_total || 0,
          express_price: vendor.express_price || 0, express_total: vendor.express_total || 0,
          overnight_price: vendor.overnight_price || 0, overnight_total: vendor.overnight_total || 0,
          pricing1: vendor.pricing1 || 0, pricing2: vendor.pricing2 || 0,
          id: existingSetup.id,
          vendor_name: vendor.name || vendor.vendor_name || vendor.vendor_type,
          vendor_type: vendor.vendor_type,
          product_type: vendor.product_type,
          size: existingSetup.size || vendor.size,
          gia_hien_thi: existingSetup.total_display_price || gia_hien_thi,
          gia_customsize: existingSetup.total_customize_price || gia_customsize,
          gia_ship: existingSetup.total_ship_min || gia_ship,
          coupon_percent: ep,  // ✅ Lưu %
          coupon_fee: existingSetup.coupon_fee || e_coupon_fee,
          total_price: existingSetup.final_price || (ed + ec + es),
          profit: existingSetup.profit || e_profit,
          profit_margin: existingSetup.profit_margin || e_margin,
          after_price: existingSetup.after_price || e_after,
          approved_at: vendor.approvedAt,
          source: 'assigned'
        };
      }

      return {
        id: Date.now() + idx + Math.random(),
        vendor_id: vendor.id,
        vendor_name: vendor.name || vendor.vendor_name || vendor.vendor_type || 'Unknown',
        vendor_type: vendor.vendor_type || '',
        product_type: vendor.productType || vendor.product_type || '',
        size: vendor.size || '',
        approved_by: 'Staff A',
        approved_at: vendor.approvedAt,
        sample_details: vendor.sampleDetails || '',
        gia_hien_thi: gia_hien_thi,
        gia_customsize: gia_customsize,
        gia_ship: gia_ship,
        coupon_percent: default_coupon_pct,  // ✅ Lưu %
        coupon_fee: 0,
        total_price: gia_hien_thi + gia_customsize + gia_ship,
        profit: 0,
        profit_margin: 0,
        after_price: gia_hien_thi + gia_customsize + gia_ship,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        eco_price: vendor.eco_price || 0, eco_total: vendor.eco_total || 0,
        fast_price: vendor.fast_price || 0, fast_total: vendor.fast_total || 0,
        express_price: vendor.express_price || 0, express_total: vendor.express_total || 0,
        overnight_price: vendor.overnight_price || 0, overnight_total: vendor.overnight_total || 0,
        pricing1: vendor.pricing1 || 0, pricing2: vendor.pricing2 || 0,
        source: 'assigned'
      };
    });

    const uniquePriceList = newPriceList.filter((item, index, self) =>
      index === self.findIndex((t) => (
        t.product_type === item.product_type && 
        t.vendor_type === item.vendor_type &&
        t.vendor_name === item.vendor_name &&
        t.size === item.size
      ))
    );

    if (uniquePriceList.length > 0) {
      setAssignedPriceList(uniquePriceList);
      localStorage.setItem(LS_PRICE_KEY, JSON.stringify(uniquePriceList));
    }
  }, []);

  const loadApprovedVendors = useCallback(() => {
    try {
      const vendors = [];

      const currentProductVendors = lsGet(LS_PRODUCT_VENDORS, {});

      if (typeof currentProductVendors !== 'object' || currentProductVendors === null) {
        console.warn('currentProductVendors is not an object:', currentProductVendors);
        return;
      }

      const currentSampleDecisions = (() => {
        try {
          const raw = localStorage.getItem(LS_SAMPLE_DECISIONS);
          return raw ? JSON.parse(raw) : {};
        } catch {
          console.error('Error parsing LS_SAMPLE_DECISIONS');
          return {};
        }
      })();

      const currentAFeedbackResponses = lsGet(LS_A_FEEDBACK_RESPONSE, {});
      const currentBSubmittedFeedbacks = lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {});

      Object.entries(currentProductVendors).forEach(([productId, vendorList]) => {
        if (!Array.isArray(vendorList)) return;

        const productDecisions = currentSampleDecisions[productId] || {};
        const productResponses = currentAFeedbackResponses[productId] || {};
        const productBFeedbacks = currentBSubmittedFeedbacks[productId] || {};

        vendorList.forEach((vendor, idx) => {
          if (!vendor) return;

          const key = vendor.id ? String(vendor.id) : `idx_${idx}`;

          // ✅ ĐIỀU KIỆN MỚI: Cả Staff B và Staff A đều approve
          const staffBApproved = productBFeedbacks[key]?.staff_b_approved === true;
          const staffAApproved = productResponses[key]?.staff_a_approved === true ||
            productDecisions[key]?.staff_a_approved === true;

          // Tạm thời cho phép hiển thị tất cả các vendor đã gán để test UI tính giá
          const isFullyApproved = true; // Bỏ qua điều kiện staffBApproved && staffAApproved

          if (isFullyApproved) {
            vendors.push({
              ...vendor,
              productId: productId,
              productType: vendor.product_type,
              approvedAt: productResponses[key]?.respondedAt || productDecisions[key]?.time || new Date().toISOString(),
              sampleDetails: productDecisions[key]?.sampleDetails || productResponses[key]?.sampleDetails || '',
              vendorKey: key,
              source: 'assigned',
              staff_b_approved: true,
              staff_a_approved: true
            });
          }
        });
      });

      if (vendors.length > 0) {
        setApprovedVendors(vendors);
        generatePriceListFromApprovedVendors(vendors);
      } else {
        setApprovedVendors([]);
        setAssignedPriceList([]);
      }
    } catch (err) {
      console.error('loadApprovedVendors error:', err);
      setComponentError(err.message);
    }
  }, [generatePriceListFromApprovedVendors]);

  useEffect(() => {
    try {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        loadApprovedVendors();
      }

      const sync = () => {
        try {
          loadApprovedVendors();
        } catch (err) {
          console.error('Sync error:', err);
          setComponentError(err.message);
        }
      };

      window.addEventListener('storage', sync);
      return () => {
        window.removeEventListener('storage', sync);
      };
    } catch (err) {
      console.error('SetupPriceSection initialization error:', err);
      setComponentError(err.message);
    }
  }, [loadApprovedVendors]);
  if (componentError) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: HC.danger }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Có lỗi xảy ra</div>
        <div style={{ fontSize: 13, marginTop: 8, color: HC.muted }}>{componentError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 20, padding: '8px 20px', borderRadius: 8, background: HC.orange, color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Tải lại trang
        </button>
      </div>
    );
  }
  const showToastMsg = (type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  };

  // Filter
  const filteredAssignedList = assignedPriceList.filter(p => {
    const matchSearch = !search || p.product_type.toLowerCase().includes(search.toLowerCase());
    const matchFilter = !filterProductType || p.product_type.toLowerCase().includes(filterProductType.toLowerCase());
    return matchSearch && matchFilter;
  });

  const totalPagesAssigned = Math.ceil(filteredAssignedList.length / ITEMS_PER_PAGE_PRICE);
  const pagedAssignedList = filteredAssignedList.slice((currentPageAssigned - 1) * ITEMS_PER_PAGE_PRICE, currentPageAssigned * ITEMS_PER_PAGE_PRICE);

  const productTypes = [...new Set(assignedPriceList.map(p => p.product_type))];

  // Component PriceTable có thêm cột Coupon Fee
  const PriceTable = ({ data, onSetupPrice, onDelete }) => (
    <div style={{ overflowX: 'auto', borderRadius: 14, border: `1.5px solid ${HC.border}`, background: HC.surface, boxShadow: `0 4px 12px rgba(0,0,0,0.05)`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
        <thead>
          <tr style={{ background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})` }}>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>STT</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'left' }}>Vendor Name</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'left' }}>Vendor Type</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'left' }}>Product Type</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>Size</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Giá hiển thị</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Total custom</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Total ship</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Total Price</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>10%</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>2.5%</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>17%</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Profit</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Tỷ lệ profit/price (fulfill)</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Profit Margin</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>After Total Price</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'center', minWidth: 120 }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, idx) => {
            // Tính Total Price = Total giá hiển thị + Total Customize + Total Ship
            const totalPrice = (p.gia_hien_thi || 0) + (p.gia_customsize || 0) + (p.gia_ship || 0);

            return (
              <tr key={p.id} style={{ borderBottom: `1px solid ${HC.border}`, background: idx % 2 === 0 ? '#ffffff' : HC.surface2 }}>
                <td style={{ padding: '10px 10px', textAlign: 'center', color: HC.muted, fontWeight: 600 }}>{idx + 1}</td>
                <td style={{ padding: '10px 10px', fontWeight: 700, color: HC.ink2 }}>{p.vendor_name || '—'}</td>
                <td style={{ padding: '10px 10px', fontWeight: 700, color: p.vendor_type === 'Best Seller' ? '#D4A017' : HC.orange }}>
                  {p.vendor_type || '—'}
                  {p.vendor_type === 'Best Seller' && <span style={{ marginLeft: 6, fontSize: 11 }}>⭐</span>}
                </td>
                <td style={{ padding: '10px 10px', color: HC.ink2, fontWeight: 600 }}>{p.product_type || '—'}</td>
                <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 600, color: HC.muted }}>{p.size || '—'}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.orangeDark }}>${(p.gia_hien_thi || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.brown }}>${(p.gia_customsize || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>${(p.gia_ship || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: HC.success, background: '#ecfdf5' }}>${totalPrice.toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.warning }}>
                  ${((p.coupon_percent || 0) * ((p.gia_hien_thi || 0) + (p.gia_customsize || 0)) / 100).toFixed(2)}
                  <span style={{ fontSize: 10, color: HC.muted2, marginLeft: 4 }}>({p.coupon_percent || 0}%)</span>
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>${(p.coupon_fee || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.orangeDark }}>${(p.amz_fee || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: (p.profit || 0) > 0 ? HC.success : HC.danger }}>${(p.profit || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: (p.profit || 0) > 0 ? HC.success : HC.danger }}>
                  {p.base_cost ? ((p.profit || 0) / p.base_cost * 100).toFixed(2) : ((p.total_price_2) ? ((p.profit || 0) / p.total_price_2 * 100).toFixed(2) : 0)}%
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: (p.profit_margin || 0) > 20 ? HC.success : HC.warning }}>{(p.profit_margin || 0).toFixed(2)}%</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.success }}>${(p.after_price || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => onSetupPrice(p)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>Setup giá</button>
                    <button onClick={() => onDelete(p)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#fef2f2', color: HC.danger, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Xóa</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Component PriceInputGroup
  const PriceInputGroup = ({ label, icon, prices, onUpdate, onUpdateName, onAdd, onRemove, unit = '$', isNamed = false }) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: HC.muted, marginBottom: 8, display: 'block' }}>
        {icon} {label}
      </label>
      {prices.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          {isNamed && (
            <input
              type="text"
              value={item.name}
              onChange={(e) => onUpdateName(idx, e.target.value)}
              placeholder="Tên (VD: Hộp quà)"
              style={{ ...inp, padding: '10px 12px', flex: 1 }}
            />
          )}
          <input
            type="number"
            step="0.01"
            value={isNamed ? item.price : item}
            onChange={(e) => onUpdate(idx, e.target.value)}
            placeholder={isNamed ? "0.00" : `${label} ${idx + 1}`}
            style={{ ...inp, padding: '10px 12px', flex: isNamed ? 1 : 1 }}
          />
          {prices.length > 1 && (
            <button
              type="button"
              onClick={() => onRemove(idx)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: HC.danger,
                cursor: 'pointer',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 8,
          padding: '8px 16px',
          borderRadius: 8,
          background: HC.orangeLight,
          border: `1.5px solid ${HC.orangeMid}`,
          color: HC.orangeDark,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <span style={{ fontSize: 14 }}>+</span> Thêm {label}
      </button>
      <div style={{ marginTop: 8, fontSize: 11, color: HC.success, fontWeight: 600 }}>
        Tổng: {unit}{prices.reduce((sum, p) => sum + (isNamed ? parseFloat(p.price || 0) : parseFloat(p || 0)), 0).toFixed(2)}
      </div>
    </div>
  );

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, animation: 'slideIn 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards', maxWidth: 380 }}>
          <div style={{ background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : toast.type === 'error' ? `linear-gradient(135deg, ${HC.danger}, #b91c1c)` : `linear-gradient(135deg, ${HC.warning}, #d97706)`, color: '#fff', borderRadius: 12, boxShadow: HC.shadowStrong, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}</span>
              <div><div style={{ fontWeight: 900, fontSize: 13 }}>{toast.title}</div><div style={{ fontSize: 11, opacity: 0.9 }}>{toast.message}</div></div>
              <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.5)', animation: `progressBar ${(toast.duration || 5000) / 1000}s linear forwards`, transformOrigin: 'left' }} />
          </div>
        </div>
      )}




      {/* Bảng Vendor từ Uyên Hồ gán */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 6, height: 24, borderRadius: 99, background: `linear-gradient(to bottom, ${HC.orange}, ${HC.orangeDark})` }} />
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink }}>🏪 Vendor từ Uyên Hồ gán</div>
          <span style={{ padding: '2px 10px', borderRadius: 20, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11, fontWeight: 700 }}>{filteredAssignedList.length} vendor</span>
        </div>
        {filteredAssignedList.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: HC.surface, borderRadius: 12, border: `1px solid ${HC.border}` }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🏪</div>
            <div style={{ fontWeight: 600, color: HC.muted }}>Chưa có vendor nào được Uyên Hồ gán và duyệt</div>
            <div style={{ fontSize: 12, color: HC.muted2, marginTop: 4 }}>Vui lòng chờ Uyên Hồ gán vendor cho sản phẩm</div>
          </div>
        ) : (
          <>
            <PriceTable
              data={pagedAssignedList}
              onSetupPrice={handleOpenSetupModal}
              onDelete={handleDeletePriceSetup}
            />
            {totalPagesAssigned > 1 && (
              <Pagination
                currentPage={currentPageAssigned}
                totalPages={totalPagesAssigned}
                totalItems={filteredAssignedList.length}
                onPageChange={setCurrentPageAssigned}
                itemsPerPage={10}
              />
            )}
          </>
        )}
      </div>

      {/* Modal Setup Giá */}


      {showSetupModal && selectedVendor && (
        <div onClick={() => setShowSetupModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 700, maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', background: HC.surface, borderRadius: 20, boxShadow: HC.shadowStrong }}>

            <div style={{ padding: '16px 24px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', borderRadius: '20px 20px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>⚙️ Setup Giá Bán</div>
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                    {selectedVendor.vendor_type || '—'} · {selectedVendor.product_type || '—'}
                  </div>
                </div>
                <button onClick={() => setShowSetupModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Size */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>📏 Size</label>
                <input
                  type="text"
                  value={setupForm.size}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, size: e.target.value }))}
                  placeholder="Nhập size (VD: S, M, L, XL...)"
                  style={{ ...inp, padding: '10px 12px' }}
                />
              </div>

              {/* 3 nhóm input */}
              <PriceInputGroup
                label="Total Giá hiển thị"
                icon="💰"
                prices={displayPrices}
                onUpdate={(idx, val) => updatePriceField('display', idx, val)}
                onAdd={() => addPriceField('display')}
                onRemove={(idx) => removePriceField('display', idx)}
              />

              <PriceInputGroup
                label="Total giá Customize"
                icon="🎨"
                prices={customizePrices}
                isNamed={true}
                onUpdate={(idx, val) => updatePriceField('customize', idx, val)}
                onUpdateName={(idx, val) => updatePriceName('customize', idx, val)}
                onAdd={() => addPriceField('customize')}
                onRemove={(idx) => removePriceField('customize', idx)}
              />

              <PriceInputGroup
                label="Total giá Ship "
                icon="🚚"
                prices={shipPrices}
                isNamed={true}
                onUpdate={(idx, val) => updatePriceField('ship', idx, val)}
                onUpdateName={(idx, val) => updatePriceName('ship', idx, val)}
                onAdd={() => addPriceField('ship')}
                onRemove={(idx) => removePriceField('ship', idx)}
              />

              {/* Dropdown chọn phương thức vận chuyển */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: HC.muted, marginBottom: 4, display: 'block' }}>📦 Chọn phương thức vận chuyển</label>
                <select
                  value={setupForm.shipping_method}
                  onChange={(e) => handleShippingMethodChange(e.target.value)}
                  style={{ ...inp, padding: '10px 12px', cursor: 'pointer' }}
                >
                  <option value="economy">🚚 Economy (Chậm nhất, rẻ nhất)</option>
                  <option value="fast">⚡ Ground/Fast (Trung bình)</option>
                  <option value="express">✈️ Express (Nhanh)</option>
                  <option value="overnight">🌙 Overnight (Qua đêm)</option>
                </select>

                <div style={{ marginTop: 12, padding: '12px 16px', background: HC.orangeLight, borderRadius: 10, border: `1px solid ${HC.orangeMid}` }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: HC.orangeDark, marginBottom: 8 }}>📊 Thông tin từ Vendor:</div>

                  {/* Bố cục 2 cột đều nhau */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                    {/* Cột 1: Vendor Name (full width) */}
                    <div style={{ gridColumn: '1 / -1', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: HC.muted }}>🏪 Vendor Name:</span>
                      <div style={{ fontWeight: 800, fontSize: 15, color: HC.orangeDark, marginTop: 2 }}>
                        {selectedVendor?.vendor_name || selectedVendor?.name || selectedVendor?.vendor_type || 'Chưa có thông tin'}
                      </div>
                    </div>

                    {/* Hàng 2: Loại Ship + Price Ship */}
                    <div>
                      <span style={{ fontSize: 11, color: HC.muted }}>🚚 Loại Ship:</span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark, marginTop: 2 }}>
                        {getShippingMethodLabel(setupForm.shipping_method)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: HC.muted }}>💰 Price Ship:</span>
                      <div style={{ fontWeight: 800, fontSize: 16, color: HC.success, marginTop: 2 }}>
                        ${shipInfo.ship_price.toFixed(2)}
                      </div>
                    </div>

                    {/* Hàng 3: Total Price (Fulfill) - chiếm 2 cột */}
                    <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: HC.muted }}>📦 Total Price (Fulfill):</span>
                      <div style={{ fontWeight: 800, fontSize: 18, color: HC.success, marginTop: 2 }}>
                        ${shipInfo.total_price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trường Coupon nhập tay */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: HC.muted, marginBottom: 4, display: 'block' }}>🎫 Coupon % (nhập tay)</label>
                <input
                  type="number"
                  step="0.01"
                  value={setupForm.coupon_percent}
                  onChange={(e) => {
                    const newPercent = parseFloat(e.target.value) || 0;
                    setSetupForm(prev => ({ ...prev, coupon_percent: newPercent }));
                    setTimeout(() => calculateSetupPrices(), 0);
                  }}
                  placeholder="Nhập % coupon (VD: 5, 10, 15...)"
                  style={{ ...inp, padding: '10px 12px' }}
                />
                <div style={{ fontSize: 10, color: HC.muted2, marginTop: 4 }}>
                  💡 Công thức: <strong>Coupon = % × (Total Price - Giá Ship)</strong>
                </div>
              </div>
              {/* Kết quả tính toán - thêm dòng Coupon Fee */}
              <div style={{ background: '#ecfdf5', borderRadius: 12, padding: '16px', border: '1px solid #bbf7d0', marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#065f46', marginBottom: 12 }}>💰 Kết quả tính toán:</div>

                {/* Dòng 1: 3 cột */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>Tổng giá hiển thị:</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark }}>${getTotalDisplayPrice().toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>Tổng giá Customize:</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark }}>${getTotalCustomizePrice().toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>Tổng giá Ship:</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark }}>${getTotalShipMin().toFixed(2)}</div>
                  </div>
                </div>

                {/* Total Price (1) */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>📦 Total Price (1):</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: HC.success }}>
                    ${(getTotalDisplayPrice() + getTotalCustomizePrice() + getTotalShipMin()).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= Giá hiển thị + Customize + Ship</div>
                </div>

                {/* Total Price (2) - từ phương thức vận chuyển */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>🚚 Total Price (2) - {getShippingMethodLabel(setupForm.shipping_method)}:</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: HC.orangeDark }}>
                    ${shipInfo.total_price.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= Giá ship + Fulfill (từ Vendor)</div>
                </div>

                {/* Coupon */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>🎫 Coupon ({setupForm.coupon_percent}%):</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: HC.warning }}>
                    -${(setupForm.coupon_amount || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2, marginTop: 4 }}>
                    = {setupForm.coupon_percent}% × (Total Price (1) - Ship) = {setupForm.coupon_percent}% × ${(getTotalDisplayPrice() + getTotalCustomizePrice()).toFixed(2)}
                  </div>
                </div>

                {/* After Price */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>💰 After Price:</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#16a34a' }}>
                    ${(setupForm.final_price - (setupForm.coupon_amount || 0)).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= Total Price (1) - Coupon</div>
                </div>

                {/* Coupon Fee */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>📋 Coupon Fee (2.5%):</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#d97706' }}>
                    ${(setupForm.coupon_fee || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= 2.5% × (Total Price (1) - Ship - Coupon)</div>
                </div>

                {/* AMZ Fee */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>📋 AMZ Fee (17%):</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark }}>
                    ${(setupForm.amz_fee || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= 17% × After Price</div>
                </div>

                {/* Base Cost = Total Price (2) */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>📦 Base Cost:</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#d97706' }}>
                    ${shipInfo.total_price.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= Total Price (2) từ phương thức vận chuyển đã chọn</div>
                </div>

                {/* Profit và Margin */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0', marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>💵 Profit:</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: setupForm.profit > 0 ? HC.success : HC.danger }}>
                      ${setupForm.profit.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: HC.muted2 }}>= Total(1) - Coupon - Fee - AMZ - Base</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>📊 Profit Margin:</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: setupForm.profit_margin > 20 ? HC.success : HC.warning }}>
                      {setupForm.profit_margin.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 10, color: HC.muted2 }}>= Profit / Total Price (1)</div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleAddComparison} style={{ padding: '8px 16px', borderRadius: 8, background: HC.surface, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>⚖️</span> Thêm vào so sánh
                </button>
              </div>

              {comparisonList.length > 0 && (
                <div style={{ background: HC.surface2, borderRadius: 12, padding: '16px', border: `1px solid ${HC.border}`, marginBottom: 20 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: HC.ink, marginBottom: 12 }}>⚖️ Bảng so sánh các kịch bản</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
                      <thead style={{ background: HC.orangePale }}>
                        <tr>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: HC.brown, borderBottom: `1px solid ${HC.border}` }}>Kịch bản</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: HC.brown, borderBottom: `1px solid ${HC.border}` }}>Total (1)</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: HC.brown, borderBottom: `1px solid ${HC.border}` }}>Profit ($)</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: HC.brown, borderBottom: `1px solid ${HC.border}` }}>Profit Margin</th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: HC.brown, borderBottom: `1px solid ${HC.border}` }}>Profit/Fulfill</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: HC.brown, borderBottom: `1px solid ${HC.border}` }}>Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonList.map((item, idx) => (
                          <tr key={item.id} style={{ borderBottom: `1px solid ${HC.border}` }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: HC.ink2 }}>
                              <div>{item.shipping_method_label}</div>
                              <div style={{ fontSize: 10, color: HC.muted }}>Coupon: {item.coupon_percent}%</div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>${item.total_price_1.toFixed(2)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: item.profit > 0 ? HC.success : HC.danger }}>${item.profit.toFixed(2)}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: item.profit_margin > 20 ? HC.success : HC.warning }}>{item.profit_margin.toFixed(2)}%</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: item.profit_fulfill > 0 ? HC.success : HC.danger }}>{item.profit_fulfill.toFixed(2)}%</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button onClick={() => handleRemoveComparison(item.id)} style={{ padding: '4px 8px', borderRadius: 6, background: '#fee2e2', border: '1px solid #fecaca', color: HC.danger, cursor: 'pointer', fontSize: 11 }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: `1px solid ${HC.border}`, display: 'flex', gap: 12, justifyContent: 'flex-end', background: HC.surface2, borderRadius: '0 0 20px 20px' }}>
              <button onClick={() => setShowSetupModal(false)} style={{ padding: '10px 20px', borderRadius: 10, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer', fontWeight: 700 }}>Hủy</button>
              <button onClick={handleSaveSetupPrice} style={{ padding: '10px 28px', borderRadius: 10, background: `linear-gradient(135deg, ${HC.success}, #15803d)`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>💾 Lưu Setup Giá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


