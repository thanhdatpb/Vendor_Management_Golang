// ════════════════════════════════════════════════════════
//  PRICE SHEET WORKSPACE — bản số hoá của Google Sheet tính giá
//  Price Setting → Product Type (Phôi) → Size → Customize Info → kết quả
//
//  Redesign 2026-07: 1 hệ màu duy nhất (neutral + amber + semantic) —
//  tokens tập trung ở pricesheet/tokens.js, UI tách component:
//  PriceSettingPanel / ProductTypeCard / PriceTable / SummaryFooter /
//  AddCustomizeInfoModal / AddProductTypeModal / HistoryPanel.
//  LOGIC TÍNH GIÁ + STATE + API GIỮ NGUYÊN 100%.
// ════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useRef } from 'react';
import { HistoryOutlined } from '@ant-design/icons';
import {
  summarizeSheet, num, pct,
  makeSize, makeProductType, uid, productTypeCompareCounts,
} from '../../utils/pricingEngine';
import { loadVendorLibraryIndex, findLibraryEntry, findLibraryRecord } from '../../utils/vendorLibraryIndex';
import { resolveSheet, baseSizesOf as baseSizesOfLib, restoreFromLibrary, libLabelOf, makeProductTypeFromRecord } from '../../utils/resolveSheet';
import { moveByDelta, moveById, orderIdsOf } from '../../utils/sheetStructure';
import { exportSheetToExcel } from '../../utils/sheetExport';
import { fmtVNDateTime } from '../../utils/vnTime';
import { createAutosave } from '../../utils/autosaveScheduler';
import {
  saveDraft, readDraft, clearDraft, draftDiffers, isStaleDraft, contentSignature,
} from '../../utils/priceSheetDraft';

import { PS, marginTone } from './pricesheet/tokens';
import { PsStyles, Btn, IconBtn, Badge, ConfirmDialog, ModalShell } from './pricesheet/primitives';
import PriceSettingPanel from './pricesheet/PriceSettingPanel';
import ProductTypeCard from './pricesheet/ProductTypeCard';
import AddCustomizeInfoModal from './pricesheet/AddCustomizeInfoModal';
import AddProductTypeModal from './pricesheet/AddProductTypeModal';
import HistoryPanel from './pricesheet/HistoryPanel';
import SummaryFooter from './pricesheet/SummaryFooter';
import DraftRestoreBanner from './pricesheet/DraftRestoreBanner';

// ═══ Export ra Excel — logic dựng dữ liệu nằm ở utils/sheetExport.js (T0) ═══
// Re-export để SetupPriceSection giữ nguyên đường import cũ.
export { exportSheetToExcel };

// ═══ Nhịp tự lưu — chọn theo TẢI, không phải theo cảm giác ═══════════════
// Mỗi lượt ghi gửi cả blob bảng lên server (vài chục KB) và bump cache danh
// sách, nên nhịp quá dày là tự làm chậm chính mình:
//   • AUTOSAVE_DELAY  — ngừng tay 2,5s mới ghi. Gõ một dòng size liền mạch
//     chỉ tốn ĐÚNG MỘT request, thay vì một request mỗi ô.
//   • AUTOSAVE_MAX_WAIT — trần 20s cho người gõ không nghỉ: mất mạng giữa
//     chừng thì cùng lắm mất 20 giây cuối, mà tải vẫn ≤ 3 request/phút/người.
//   • DRAFT_THROTTLE — nháp ở máy ghi ngay lần đầu (lưới an toàn phải có mặt
//     tức thì), sau đó tối đa 1 lần/giây: localStorage.setItem là I/O đồng bộ,
//     gọi theo từng phím sẽ giật tay người nhập trên bảng nhiều size.
const AUTOSAVE_DELAY = 2500;
const AUTOSAVE_MAX_WAIT = 20000;
const DRAFT_THROTTLE = 1000;

export default function PriceSheetWorkspace({ sheet, onSave, onClose, showToast }) {
  const [name, setName] = useState(sheet.name || '');
  // Quantity mặc định = 1; bảng cũ (tạo trước khi có Quantity) hiện trống → coi như 1.
  const [settings, setSettings] = useState(() => ({
    ...sheet.settings,
    quantity: num(sheet.settings?.quantity) > 0 ? sheet.settings.quantity : 1,
  }));
  const [productTypes, setProductTypes] = useState(() =>
    (sheet.productTypes?.length ? sheet.productTypes : [makeProductType('Product Type 1')]).map((pt) => ({
      ...pt, shown: pt.shown !== false,
    }))
  );
  const [showHistory, setShowHistory] = useState(false);
  const [libIndex, setLibIndex] = useState(null);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(null); // ptId
  const [showAddPTDialog, setShowAddPTDialog] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null); // snapshot
  const [saving, setSaving] = useState(false);
  // Xung đột phiên bản (mục 16): { updatedBy, updatedAt, currentVersion, current }
  const [conflict, setConflict] = useState(null);
  // Hỏi trước khi thoát khi còn nội dung chưa lên được server.
  const [confirmExit, setConfirmExit] = useState(false);

  // ── HAI khái niệm "đã lưu", cố ý KHÔNG gộp ────────────────────────────
  //  • syncedSigRef  — nội dung đã nằm trên server (autosave hoặc chốt mốc).
  //    Quyết định autosave có việc để làm, và có cảnh báo khi thoát không.
  //  • versionSigRef — nội dung của MỐC phiên bản gần nhất. Quyết định nút
  //    "Lưu bảng tính giá" có sáng không — nhờ vậy bấm Lưu nhiều lần không đẻ
  //    ra nhiều bản lịch sử giống hệt nhau (trần 20 bản, mốc thật bị đẩy ra).
  const contentSig = useMemo(
    () => contentSignature({ name, settings, productTypes }),
    [name, settings, productTypes]
  );
  const syncedSigRef = useRef(null);
  const versionSigRef = useRef(null);
  if (syncedSigRef.current == null) {
    syncedSigRef.current = contentSig;
    versionSigRef.current = contentSig;
  }
  const unsynced = contentSig !== syncedSigRef.current;
  const dirty = contentSig !== versionSigRef.current;

  const [autosaveStatus, setAutosaveStatus] = useState({ state: 'idle' });
  // Nháp còn sót ở máy này (autosave hỏng / đóng tab giữa chừng). ĐỌC NGAY lúc
  // khởi tạo state: hiệu ứng autosave bên dưới sẽ ghi đè khoá này ngay khi có
  // thay đổi đầu tiên, đọc muộn hơn là đọc phải nháp của chính phiên này.
  const [pendingDraft, setPendingDraft] = useState(() => {
    const draft = readDraft(sheet.id);
    return draft && draftDiffers(draft, { name, settings, productTypes }) ? draft : null;
  });
  const applyConflictRef = useRef(null);

  useEffect(() => {
    loadVendorLibraryIndex(sheet.project || '', !sheet.project).then(setLibIndex).catch(console.error);
  }, [sheet.project]);

  const draftSheet = useMemo(
    () => resolveSheet({ ...sheet, name, settings, productTypes }, libIndex),
    [sheet, name, settings, productTypes, libIndex]
  );
  const summary = useMemo(() => summarizeSheet(draftSheet), [draftSheet]);

  // ── TỰ LƯU ────────────────────────────────────────────────────────────
  // Payload dựng LÚC GỬI, không phải lúc lên lịch: `sheet.version` đổi sau mỗi
  // lượt ghi, đóng băng payload sớm là tự gửi version cũ rồi tự nhận 409 của
  // chính mình. Payload KHÔNG kèm `history` (xem priceSheetApi.save) nên
  // autosave không tạo phiên bản nào.
  const saveNowRef = useRef(null);
  saveNowRef.current = async () => {
    const sig = contentSig;
    await Promise.resolve(onSave({ ...draftSheet, updatedAt: new Date().toISOString() }, { autosave: true }));
    syncedSigRef.current = sig;
    clearDraft(sheet.id); // server đã giữ nội dung này, nháp ở máy hết việc
  };

  const autosaveRef = useRef(null);
  if (!autosaveRef.current) {
    autosaveRef.current = createAutosave({
      delay: AUTOSAVE_DELAY,
      maxWait: AUTOSAVE_MAX_WAIT,
      save: () => saveNowRef.current(),
      onStatus: (status) => {
        setAutosaveStatus(status);
        // 409 giữa lúc đang gõ: hỏi người dùng đúng như khi bấm Lưu (mục 16).
        // Autosave tự `force` sẽ là kiểu âm thầm xoá công người khác.
        if (status.state === 'conflict') applyConflictRef.current?.(status.error);
      },
    });
  }

  // Mỗi thay đổi: ghi nháp ở máy trước (lưới an toàn), rồi xếp lịch đẩy lên
  // server. Nháp ghi theo kiểu leading + trailing: lần đầu ghi ngay, các lần
  // sau gom lại tối đa 1 lần/giây — xem DRAFT_THROTTLE.
  const draftTimerRef = useRef({ at: 0, timer: null });
  useEffect(() => {
    if (!sheet.id) return undefined;
    if (contentSig === syncedSigRef.current) return undefined;

    const pace = draftTimerRef.current; // giữ đúng object cho nhánh cleanup
    const write = () => {
      pace.at = Date.now();
      saveDraft(sheet.id, { baseVersion: sheet.version ?? null, name, settings, productTypes });
    };
    const since = Date.now() - pace.at;
    if (since >= DRAFT_THROTTLE) {
      write();
    } else {
      clearTimeout(pace.timer);
      pace.timer = setTimeout(write, DRAFT_THROTTLE - since);
    }

    autosaveRef.current.schedule(contentSig);
    return () => clearTimeout(pace.timer);
  }, [contentSig, sheet.id, sheet.version, name, settings, productTypes]);

  // Rời tab / đóng cửa sổ / rời workspace: ghi nốt phần đang chờ thay vì mất
  // 1,5 giây cuối cùng của người dùng.
  useEffect(() => {
    const flush = () => { autosaveRef.current?.flush(); };
    const onVisibility = () => { if (document.hidden) flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
      autosaveRef.current?.stop();
    };
  }, []);

  // Chưa lên được server mà F5 / đóng tab: để trình duyệt hỏi lại. Nháp vẫn
  // nằm ở máy, nhưng người dùng phải biết là nó CHƯA lên server.
  useEffect(() => {
    if (!unsynced) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsynced]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    setName(pendingDraft.name || '');
    setSettings({ ...pendingDraft.settings });
    setProductTypes((pendingDraft.productTypes || []).map((pt) => ({ ...pt, shown: pt.shown !== false })));
    setPendingDraft(null);
    showToast?.('success', 'Đã khôi phục bản nháp', 'Nội dung đang được tự lưu lên server.');
  };

  const discardDraft = () => { clearDraft(sheet.id); setPendingDraft(null); };

  // ── mutations (GIỮ NGUYÊN) ──
  const setSetting = (k, v) => setSettings((p) => ({ ...p, [k]: v }));
  const patchPT = (ptId, patch) => setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, ...patch } : pt)));
  const toggleShown = (ptId) => setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, shown: !pt.shown } : pt)));
  const addPT = () => setProductTypes((p) => [...p, makeProductType(`Product Type ${p.length + 1}`)]);
  // Thêm product type bằng cách CHỌN MỘT RECORD cụ thể từ thư viện vendor
  // (mục 03/04) — record đã gồm sẵn vendor + file nguồn, gắn thẳng vào
  // `pt.libRef` để resolveSheet tra đúng record đó, không tra lại theo tên.
  // Nhờ vậy 2 vendor cùng tên phôi thêm được thành 2 block riêng, không đè nhau.
  const addPTFromLibrary = (record) => {
    setProductTypes((p) => [...p, makeProductTypeFromRecord(record)]);
    setShowAddPTDialog(false);
  };
  // Confirm xoá đã chuyển vào ConfirmDialog trong ProductTypeCard
  const removePT = (ptId) => setProductTypes((p) => p.filter((pt) => pt.id !== ptId));
  // Size Seller tự thêm mang `origin: 'manual'` để resolveSheet giữ lại qua mỗi
  // lần bind thư viện (mục 02) — thiếu dấu này là dòng biến mất ngay lần render sau.
  // Có `sizeOrder` thì nối id mới vào cuối, nếu không dòng mới bị orderSizes đẩy
  // về cuối một cách tình cờ thay vì theo đúng chỗ Seller vừa thêm.
  const addSize = (ptId) => setProductTypes((p) => p.map((pt) => {
    if (pt.id !== ptId) return pt;
    const row = { ...makeSize(), origin: 'manual', isLib: false };
    const sizes = [...baseSizesOf(pt), row];
    return {
      ...pt, sizes,
      ...(pt.sizeOrder?.length ? { sizeOrder: [...pt.sizeOrder, row.id] } : {}),
    };
  }));
  const removeSize = (ptId, szId) => {
    setProductTypes((prevPTs) => prevPTs.map((pt) => {
      if (pt.id !== ptId) return pt;
      const currentSizes = baseSizesOf(pt);
      if (currentSizes.length <= 1) return pt;
      const toRemove = currentSizes.find((s) => s.id === szId);
      if (!toRemove) return pt;

      // Lưu ý: `isLib` chỉ được resolveSheet gắn vào khi render (draftSheet),
      // KHÔNG tồn tại trên state pt gốc. Cách nhận biết size thư viện tin cậy
      // nhất là kiểm tra prefix ID — libSizeId() luôn tạo ra `szlib_<ptId>_<...>`,
      // trong khi size tự thêm dùng uid('sz') = `sz_<timestamp>_<random>`.
      const isLibSize = szId.startsWith('szlib_');
      const label = libLabelOf(toRemove);

      const nextDeletedSizes = [...(pt.deletedSizes || [])];
      if (isLibSize && label && !nextDeletedSizes.includes(label)) {
        nextDeletedSizes.push(label);
      }

      const updatedPtSizes = (pt.sizes || []).filter((s) => s.id !== szId);

      return {
        ...pt,
        sizes: updatedPtSizes,
        deletedSizes: nextDeletedSizes,
        ...(pt.sizeOrder?.length ? { sizeOrder: pt.sizeOrder.filter((id) => id !== szId) } : {}),
      };
    }));
  };
  const updateSize = (ptId, szId, patch) => patchPTSizes(ptId, (sizes) => sizes.map((s) => (s.id === szId ? { ...s, ...patch } : s)));
  const updateSizeCustomize = (ptId, szId, ciId, val) =>
    patchPTSizes(ptId, (sizes) => sizes.map((s) => (s.id === szId ? { ...s, customize: { ...s.customize, [ciId]: val } } : s)));
  function patchPTSizes(ptId, fn) {
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, sizes: fn(baseSizesOf(pt)) } : pt)));
  }
  // Sizes dùng làm gốc khi ghi — logic ở utils/resolveSheet.js (T0), gắn libIndex hiện tại.
  const baseSizesOf = (pt) => baseSizesOfLib(pt, libIndex);
  const openAddCustomize = (ptId) => setShowCustomizeDialog(ptId);
  const addCustomize = (ptId, name, defaultPrice) => {
    const ciId = uid('ci');
    setProductTypes((p) => p.map((pt) => {
      if (pt.id !== ptId) return pt;
      const newSizes = baseSizesOf(pt).map(sz => ({
        ...sz,
        customize: { ...sz.customize, [ciId]: defaultPrice }
      }));
      return {
        ...pt,
        sizes: newSizes,
        // `defaultPrice` ở lại trên cột: size thêm SAU này (kể cả size mới xuất
        // hiện ở thư viện) tự nhận đúng giá đó thay vì để trống (mục 06).
        customizeInfos: [...(pt.customizeInfos || []), { id: ciId, name, defaultPrice }]
      };
    }));
  };
  const renameCustomize = (ptId, ciId, nm) =>
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, customizeInfos: pt.customizeInfos.map((c) => (c.id === ciId ? { ...c, name: nm } : c)) } : pt)));
  const removeCustomize = (ptId, ciId) =>
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, customizeInfos: pt.customizeInfos.filter((c) => c.id !== ciId) } : pt)));

  // ── Thứ tự dòng size & cột customize (mục 05/06) ──
  // Thứ tự lưu ở `pt.sizeOrder` (danh sách id) chứ không phải ở thứ tự mảng
  // `sizes`: resolveSheet dựng lại mảng đó từ thư viện ở mỗi lần render, nên
  // thứ tự nằm trong mảng sẽ bị ghi đè ngay. Cột customize thì ngược lại —
  // chỉ hoán vị mảng `customizeInfos`, `ci.id` KHÔNG đổi nên không ô giá nào
  // đổi theo (giá customize bám id, không bám chỉ số cột).
  const setSizeOrderFrom = (pt, sizes) => ({ ...pt, sizeOrder: orderIdsOf(sizes) });
  const moveSize = (ptId, szId, delta) => setProductTypes((p) => p.map((pt) => {
    if (pt.id !== ptId) return pt;
    const current = baseSizesOf(pt);
    const idx = current.findIndex((s) => s.id === szId);
    return setSizeOrderFrom(pt, moveByDelta(current, idx, delta));
  }));
  const reorderSizes = (ptId, szId, toIndex) => setProductTypes((p) => p.map((pt) => (
    pt.id === ptId ? setSizeOrderFrom(pt, moveById(baseSizesOf(pt), szId, toIndex)) : pt
  )));
  const moveCustomize = (ptId, ciId, delta) => setProductTypes((p) => p.map((pt) => {
    if (pt.id !== ptId) return pt;
    const cols = pt.customizeInfos || [];
    return { ...pt, customizeInfos: moveByDelta(cols, cols.findIndex((c) => c.id === ciId), delta) };
  }));
  const reorderCustomize = (ptId, ciId, toIndex) => setProductTypes((p) => p.map((pt) => (
    pt.id === ptId ? { ...pt, customizeInfos: moveById(pt.customizeInfos || [], ciId, toIndex) } : pt
  )));

  // Bỏ mọi chỉnh sửa cấu trúc cục bộ, quay về đúng thư viện (mục 02).
  const restorePTFromLibrary = (ptId) => setProductTypes((p) => p.map((pt) => (
    pt.id === ptId ? restoreFromLibrary({ ...pt, sizes: baseSizesOf(pt) }, libIndex) : pt
  )));

  const shownPTs = productTypes.filter((pt) => pt.shown);

  // Nhóm "cùng phôi" (vấn đề #3, mindmap 2026-08-28) — nhiều Product Type block
  // trùng tên (mỗi block 1 vendor, xem addPTFromLibrary) đứng cạnh nhau để
  // Seller so sánh chiến lược giá. Chỉ gắn NHÃN nhận diện, không đổi cấu trúc
  // PriceTable/sizes — rủi ro thấp nhất trong các phương án đã cân nhắc.
  const compareCountOf = useMemo(
    () => productTypeCompareCounts(draftSheet.productTypes),
    [draftSheet.productTypes]
  );

  /** Dựng hộp thoại xung đột từ lỗi 409 — dùng chung cho cả autosave lẫn nút Lưu. */
  const showConflict = (err) => {
    const info = err?.response?.data || {};
    setConflict({
      updatedBy: info.updatedBy || 'người khác',
      updatedAt: info.updatedAt || null,
      currentVersion: info.currentVersion,
      current: info.current || null,
    });
  };
  applyConflictRef.current = showConflict;

  // ── CHỐT MỐC PHIÊN BẢN ────────────────────────────────────────────────
  // Nội dung đã được autosave đẩy lên liên tục, nên nút này chỉ còn một việc:
  // ghi một mốc vào Lịch sử tính giá (payload có `history` → server tạo bản).
  // `force` = người dùng đã xem cảnh báo xung đột và cố ý ghi đè (mục 16).
  const handleSave = async (force = false) => {
    const sig = contentSig;
    // Autosave đang chờ thì bỏ: lượt ghi này đã mang đúng nội dung đó rồi.
    autosaveRef.current?.cancel();
    const snap = {
      // Lịch sử không còn đi kèm bảng (mục 17) — số bản đọc từ `historyCount`
      // của server; server mới cũng tự đánh lại số version khi ghi.
      version: (sheet.historyCount ?? sheet.history?.length ?? 0) + 1,
      savedAt: new Date().toISOString(),
      savedBy: (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').name || 'Seller'; } catch { return 'Seller'; } })(),
      avgMargin: summary.avgMargin, minPrice: summary.minPrice, maxPrice: summary.maxPrice, count: summary.count,
      settings: draftSheet.settings, productTypes: draftSheet.productTypes,
    };
    const history = [snap, ...(sheet.history || [])].slice(0, 20);
    setSaving(true);
    try {
      await Promise.resolve(onSave(
        { ...draftSheet, history, updatedAt: new Date().toISOString() },
        { force }
      ));
      syncedSigRef.current = sig;
      versionSigRef.current = sig;
      clearDraft(sheet.id);
      if (autosaveRef.current?.isStopped()) autosaveRef.current.reset();
      setAutosaveStatus({ state: 'saved', savedAt: new Date() });
      setConflict(null);
    } catch (err) {
      // 409: có người khác đã lưu bảng này sau lúc ta mở nó. TUYỆT ĐỐI không
      // ghi đè im lặng — trước đây server là last-write-wins nên toàn bộ thay
      // đổi của người kia biến mất mà không ai biết.
      if (err?.response?.status === 409) {
        // Autosave phải im cho tới khi người dùng chọn xong, nếu không nó cứ
        // vài giây lại đâm vào đúng bức tường 409 đó.
        autosaveRef.current?.stop();
        showConflict(err);
      } else {
        showToast?.('error', 'Lưu thất bại', err?.message || 'Không lưu được lên server.');
      }
    } finally {
      setSaving(false);
    }
  };

  /** Bỏ thay đổi đang gõ, lấy bản mới nhất trên server. */
  const takeServerVersion = () => {
    const srv = conflict?.current;
    if (!srv) { onClose?.(); return; }
    // Chữ ký phải tính trên ĐÚNG mảng sắp đưa vào state (đã chuẩn hoá `shown`),
    // nếu không nội dung vừa tải về đã bị coi là "có thay đổi" và autosave đẩy
    // ngược nó lên server ngay lập tức.
    const pts = (srv.productTypes || []).map((pt) => ({ ...pt, shown: pt.shown !== false }));
    setName(srv.name || '');
    setSettings({ ...srv.settings });
    setProductTypes(pts);
    const sig = contentSignature({ name: srv.name || '', settings: srv.settings, productTypes: pts });
    syncedSigRef.current = sig;
    versionSigRef.current = sig;
    clearDraft(sheet.id);
    autosaveRef.current?.reset();
    setConflict(null);
    showToast?.('success', 'Đã tải lại', `Đang xem bản v${conflict.currentVersion} của ${conflict.updatedBy}`);
  };

  /** Đóng bảng — chỉ hỏi khi còn nội dung CHƯA lên được server. */
  const requestClose = () => {
    if (!unsynced) { onClose?.(); return; }
    setConfirmExit(true);
  };

  /** Thử ghi nốt rồi thoát. Ghi không được thì nói thẳng là nháp còn ở máy. */
  const saveThenClose = async () => {
    setSaving(true);
    try {
      await autosaveRef.current?.flush();
    } finally {
      setSaving(false);
    }
    setConfirmExit(false);
    if (contentSig !== syncedSigRef.current) {
      showToast?.('error', 'Chưa lưu được lên server',
        'Bản nháp vẫn giữ ở máy này — mở lại bảng sẽ có nút khôi phục.', 5000);
    }
    onClose?.();
  };

  const restoreVersion = (snap) => {
    setSettings({ ...snap.settings });
    setProductTypes(snap.productTypes.map((pt) => ({ ...pt, shown: pt.shown !== false })));
    setShowHistory(false);
    showToast?.('success', 'Đã khôi phục', `Về phiên bản v${snap.version}`);
  };

  const mTone = marginTone(summary.avgMargin);

  return (
    <div onClick={requestClose} className="ps-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>
      <div onClick={(e) => e.stopPropagation()} className="ps-scope" style={{
        width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
        background: PS.bgApp, overflow: 'hidden', color: PS.text,
        fontFamily: "-apple-system, 'Segoe UI', system-ui, Roboto, sans-serif",
      }}>
        <PsStyles />

        {/* ── Header — spec §3.1: nền trắng, border-bottom, meta badges ── */}
        <div style={{
          padding: '10px 20px', background: PS.bgSurface, borderBottom: `1px solid ${PS.border}`,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          {/* Tên bảng tính — text-xl + thanh accent dọc amber-400 (spec §1) */}
          <div style={{ minWidth: 0, flex: 1, borderLeft: `4px solid ${PS.accentBar}`, paddingLeft: 12 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bảng tính giá"
              aria-label="Tên bảng tính giá"
              className="ps-input ps-input-ghost"
              style={{ fontSize: 20, fontWeight: 650, color: PS.text, padding: '3px 8px', marginLeft: -8, width: `${Math.max(24, (name || '').length + 2)}ch`, maxWidth: '100%' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <Badge>{shownPTs.length}/{productTypes.length} product type · {summary.count} size</Badge>
              {summary.avgMargin != null && <Badge tone={mTone}>avg margin {pct(summary.avgMargin, 1)}</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {/* Chip trung tính + icon history + badge đếm (spec §2) */}
            <button type="button" className="ps-btn-hist" onClick={() => setShowHistory(true)}>
              <HistoryOutlined style={{ fontSize: 16 }} aria-hidden />
              Lịch sử tính giá
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                background: PS.accentSoft, color: PS.accentText,
                fontSize: 11, fontWeight: 650, fontVariantNumeric: 'tabular-nums',
              }}>{sheet.historyCount ?? sheet.history?.length ?? 0}</span>
            </button>
            <Btn variant="outline" onClick={() => exportSheetToExcel(draftSheet, showToast)}>⬇ Export Excel</Btn>
            <IconBtn title="Đóng" onClick={requestClose}>✕</IconBtn>
          </div>
        </div>

        {/* ── Bản nháp còn sót ở máy này (autosave hỏng / đóng tab giữa chừng) ── */}
        <DraftRestoreBanner draft={pendingDraft} stale={isStaleDraft(pendingDraft, sheet)}
          onRestore={restoreDraft} onDiscard={discardDraft} />

        {/* ── Price Setting — spec §3.2 ── */}
        <PriceSettingPanel settings={settings} onSet={setSetting} />

        {/* ── Chọn hiển thị Product Type (multi-select chip — GIỮ hành vi xếp chồng) ── */}
        <div style={{ padding: '10px 20px', flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: PS.textSecondary }}>
            Product Type
          </span>
          <span title="Chọn 1, 2 hay nhiều — bảng xếp chồng như sheet" aria-label="Gợi ý: chọn 1, 2 hay nhiều — bảng xếp chồng như sheet"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help',
              width: 15, height: 15, borderRadius: '50%', fontSize: 10, fontWeight: 700,
              border: `1px solid ${PS.borderStrong}`, color: PS.textMuted, marginRight: 4,
            }}>?</span>
          {productTypes.map((pt) => (
            <button key={pt.id} type="button" onClick={() => toggleShown(pt.id)} aria-pressed={pt.shown}
              className="ps-chip"
              style={{
                fontSize: 12.5, fontWeight: 650, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${pt.shown ? PS.brandBorder : PS.border}`,
                background: pt.shown ? PS.brandSubtle : PS.bgSurface,
                color: pt.shown ? PS.brandDeep : PS.textSecondary, whiteSpace: 'nowrap',
              }}>
              {pt.shown ? '✓ ' : ''}{pt.name || 'Chưa đặt tên'}
            </button>
          ))}
          <Btn variant="dashed" size="sm" onClick={() => setShowAddPTDialog(true)}
            style={{ borderRadius: 999 }}>＋ Thêm Product Type</Btn>
        </div>

        {/* ── Body: các product type xếp chồng ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {shownPTs.length === 0 && (
            <div style={{
              textAlign: 'center', color: PS.textMuted, padding: '60px 20px', fontSize: 13.5,
              background: PS.bgSurface, border: `1.5px dashed ${PS.border}`, borderRadius: 12,
            }}>
              Chọn ít nhất một Product Type để hiển thị bảng tính giá.
            </div>
          )}
          {draftSheet.productTypes.filter(pt => pt.shown).map((pt) => {
            // PT gắn `libRef` (mục 03/04) tra ĐÚNG record đã chốt, không tra lại
            // theo tên — 2 block cùng tên phôi mới không lấy nhầm vendor của nhau.
            const libEntry = pt.libRef?.recordKey
              ? findLibraryRecord(libIndex, pt.libRef.recordKey)
              : findLibraryEntry(libIndex, pt.name);
            const compareCount = compareCountOf[(pt.name || '').trim().toLowerCase()] || 0;
            return (
              <ProductTypeCard key={pt.id} pt={pt} settings={settings} libEntry={libEntry} compareCount={compareCount}
                onPT={patchPT} onRemovePT={removePT}
                onAddSize={addSize} onUpdateSize={updateSize} onRemoveSize={removeSize} onUpdateCustomize={updateSizeCustomize}
                onAddCustomize={openAddCustomize} onRenameCustomize={renameCustomize} onRemoveCustomize={removeCustomize}
                onMoveSize={moveSize} onReorderSizes={reorderSizes}
                onMoveCustomize={moveCustomize} onReorderCustomize={reorderCustomize}
                onRestoreFromLibrary={restorePTFromLibrary} />
            );
          })}
        </div>

        {/* ── Footer — spec §3.7 ── */}
        <SummaryFooter summary={summary} dirty={dirty} saving={saving}
          autosaveStatus={autosaveStatus} unsynced={unsynced}
          onCancel={requestClose} onSave={() => handleSave(false)} />
      </div>

      {/* ── Xung đột phiên bản (mục 16) ──────────────────────────────────────
          Hiện khi server trả 409: có người khác đã lưu bảng này sau lúc ta mở.
          Ba lựa chọn đều tường minh — không có nhánh nào âm thầm mất dữ liệu. */}
      {conflict && (
        <ModalShell title="⚠ Bảng này vừa được người khác cập nhật" width={460} zIndex={2500}
          onClose={() => setConflict(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setConflict(null)}>Để tôi xem lại</Btn>
            <Btn variant="outline" onClick={takeServerVersion}>Tải bản mới</Btn>
            <Btn variant="primary" disabled={saving}
              style={{ background: PS.negative, borderColor: PS.negative }}
              onClick={() => handleSave(true)}>
              {saving ? 'Đang ghi đè…' : 'Ghi đè bằng bản của tôi'}
            </Btn>
          </>}>
          <div style={{ padding: 16, fontSize: 13.5, color: PS.textSecondary, lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 12px' }}>
              <b style={{ color: PS.text }}>{conflict.updatedBy}</b> đã lưu bảng này
              {conflict.updatedAt ? ` lúc ${fmtVNDateTime(conflict.updatedAt)}` : ''}
              {conflict.currentVersion ? ` (phiên bản v${conflict.currentVersion})` : ''}.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><b>Tải bản mới</b> — bỏ thay đổi đang gõ, lấy bản trên server.</li>
              <li><b>Ghi đè</b> — giữ bản của bạn. Bản của {conflict.updatedBy} vẫn nằm trong Lịch sử tính giá, không mất hẳn.</li>
              <li><b>Để tôi xem lại</b> — đóng hộp thoại, chưa lưu gì.</li>
            </ul>
          </div>
        </ModalShell>
      )}

      {/* ── Thoát khi còn nội dung chưa lên server ──────────────────────────
          Chỉ hiện khi autosave chưa kịp/không ghi được. Cả ba lựa chọn đều
          tường minh, không nhánh nào âm thầm vứt công của người dùng. */}
      {confirmExit && (
        <ModalShell title="Còn thay đổi chưa lưu lên server" width={460} zIndex={2500}
          onClose={() => setConfirmExit(false)}
          footer={<>
            <Btn variant="ghost" onClick={() => setConfirmExit(false)}>Ở lại</Btn>
            <Btn variant="outline" onClick={() => { setConfirmExit(false); onClose?.(); }}>
              Thoát, giữ bản nháp ở máy
            </Btn>
            <Btn variant="primary" disabled={saving} onClick={saveThenClose}>
              {saving ? 'Đang lưu…' : 'Lưu rồi thoát'}
            </Btn>
          </>}>
          <div style={{ padding: 16, fontSize: 13.5, color: PS.textSecondary, lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 12px' }}>
              Một vài thay đổi vừa rồi <b style={{ color: PS.text }}>chưa lên được server</b>.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><b>Lưu rồi thoát</b> — thử ghi lại ngay bây giờ.</li>
              <li><b>Thoát, giữ bản nháp</b> — nội dung nằm lại máy này; mở lại bảng sẽ có nút khôi phục.</li>
              <li><b>Ở lại</b> — quay về bảng, tự lưu vẫn tiếp tục chạy.</li>
            </ul>
          </div>
        </ModalShell>
      )}

      {showHistory && (
        <HistoryPanel sheet={sheet} onClose={() => setShowHistory(false)}
          onRestore={(snap) => setConfirmRestore(snap)}
          onExportVersion={(snap) => exportSheetToExcel({ ...sheet, name: `${sheet.name}_v${snap.version}`, settings: snap.settings, productTypes: snap.productTypes }, showToast)} />
      )}

      {confirmRestore && (
        <ConfirmDialog title="Khôi phục phiên bản" confirmLabel="Khôi phục"
          message={`Khôi phục về phiên bản v${confirmRestore.version}? Các thay đổi chưa lưu sẽ mất.`}
          onConfirm={() => restoreVersion(confirmRestore)} onClose={() => setConfirmRestore(null)} />
      )}

      {showCustomizeDialog && (
        <AddCustomizeInfoModal onClose={() => setShowCustomizeDialog(null)} onConfirm={(name, defaultPrice) => {
          addCustomize(showCustomizeDialog, name, defaultPrice);
          setShowCustomizeDialog(null);
        }} />
      )}

      {showAddPTDialog && (
        <AddProductTypeModal
          libIndex={libIndex}
          onPick={addPTFromLibrary}
          onManual={() => { addPT(); setShowAddPTDialog(false); }}
          onClose={() => setShowAddPTDialog(false)}
        />
      )}
    </div>
  );
}
