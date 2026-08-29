// ════════════════════════════════════════════════════════
//  PRICE SHEET PAGE — /price-sheets/:id
//
//  Link riêng cho 1 bảng tính giá để gửi cho Admin xem theo phôi bán được,
//  thay vì phải đăng nhập rồi tự tìm trong danh sách.
//
//  Chỉ Admin + Seller/StaffA vào được (route đã chặn ở RoleRoute + backend
//  chặn lại ở PriceSheetController::canUsePriceSheets — 2 lớp, không tin
//  một mình frontend). Trong 2 role đó:
//    - Admin  → xem chỉ-đọc, dùng lại PriceSheetReadOnlyView của modal Admin.
//    - Seller → workspace sửa được y hệt khi mở từ danh sách (PriceSheetWorkspace
//      vốn đã là overlay full-screen position:fixed;inset:0 nên nhúng vào route
//      gần như không đổi giao diện).
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { priceSheetApi } from '../services/api';
import { saveSheetToServer } from '../utils/priceSheetCommit';
import { copyPriceSheetLink } from '../utils/priceSheetLink';
import { exportSheetToExcel } from '../utils/sheetExport';
import { HC } from '../constants/sellerTheme';
import { ADMIN_PRICE_SHEETS_PATH, SELLER_PRICE_SHEETS_PATH } from '../constants/dashboardSections';
import AppToast from '../components/shared/AppToast';
import PriceSheetWorkspace from '../components/seller/PriceSheetWorkspace';
import { PriceSheetReadOnlyView } from '../components/admin/modals/PriceSheetViewerModal';
import { PS } from '../components/seller/pricesheet/tokens';
import { Btn } from '../components/seller/pricesheet/primitives';
import HistoryPanel from '../components/seller/pricesheet/HistoryPanel';

/** Card trạng thái (đang tải / lỗi) — dùng chung style HC cho cả 3 tình huống. */
function StatusCard({ icon, title, message, actionLabel, onAction, backLabel, onBack }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(ellipse at 60% 40%, ${HC.orangeMid} 0%, ${HC.cream} 45%, ${HC.orangePale} 100%)`,
      padding: 16,
    }}>
      <div style={{
        maxWidth: 420, width: '100%', textAlign: 'center', padding: '40px 32px',
        background: 'rgba(255,253,249,0.95)', borderRadius: 20, border: `1.5px solid ${HC.orangeMid}`,
        boxShadow: '0 12px 56px rgba(245,166,35,0.18)',
      }}>
        <div style={{ fontSize: 42, marginBottom: 14 }}>{icon}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: HC.ink, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: HC.muted, marginBottom: 22, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {onAction && (
            <button onClick={onAction} style={{
              padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', fontWeight: 800, fontSize: 13,
            }}>{actionLabel}</button>
          )}
          {onBack && (
            <button onClick={onBack} style={{
              padding: '9px 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13,
              border: `1.5px solid ${HC.borderStrong}`, background: HC.surface, color: HC.brown,
            }}>{backLabel}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PriceSheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  // Bảng vừa tạo được truyền qua router state (SetupPriceSection.handleCreate).
  // Dùng thẳng, KHÔNG gọi GET: lúc điều hướng thì POST lưu lên server có thể
  // chưa xong nên GET trả 404 → người dùng gặp màn "Không tìm thấy bảng tính giá"
  // và phải quay lại danh sách mới mở được.
  const seededSheet = location.state?.sheet?.id === id ? location.state.sheet : null;
  // Về ĐÚNG mục Bảng Tính Giá, không phải dashboard trống: '/seller' | '/admin'
  // remount dashboard và rơi về mục mặc định (Seller rớt sang Quản Lý Sản Phẩm,
  // Admin rớt về Tổng Quan) — đúng mục là nơi người dùng vừa bấm mở bảng này.
  const backTo = isAdmin ? ADMIN_PRICE_SHEETS_PATH : SELLER_PRICE_SHEETS_PATH;
  const backLabel = '← Về Bảng tính giá'; // cả 2 role đều về mục Bảng Tính Giá của mình

  const [sheet, setSheet] = useState(seededSheet);
  const [status, setStatus] = useState(seededSheet ? 'ready' : 'loading'); // loading | ready | not_found | forbidden | error
  const [toast, setToast] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  const showToast = useCallback((type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await priceSheetApi.get(id);
      setSheet(res.data);
      setStatus('ready');
    } catch (err) {
      const code = err?.response?.status;
      if (code === 404) setStatus('not_found');
      else if (code === 403) setStatus('forbidden');
      else {
        console.warn('Không tải được bảng tính giá:', err?.message || err);
        setStatus('error');
      }
    }
  }, [id]);

  const hasSeed = !!seededSheet;
  useEffect(() => { if (!hasSeed) load(); }, [load, hasSeed]);

  const handleCopyLink = async () => {
    try {
      await copyPriceSheetLink(id);
    } catch (err) {
      console.warn('Copy link bảng tính giá thất bại:', err?.message || err);
      showToast('error', 'Copy link thất bại', 'Kiểm tra quyền truy cập clipboard rồi thử lại.');
    }
  };

  const handleSaveWorkspace = async (updated, opts) => {
    const synced = await saveSheetToServer(updated, { ...opts, showToast });
    setSheet(synced); // giữ version mới nhất cho lần lưu kế tiếp — xem PriceSheetWorkspace.handleSave
    return synced;
  };

  if (status === 'loading') {
    return <StatusCard icon="⏳" title="Đang tải bảng tính giá..." message="Vui lòng chờ trong giây lát." />;
  }

  if (status === 'not_found') {
    return (
      <StatusCard icon="🔍" title="Không tìm thấy bảng tính giá"
        message="Link này có thể đã bị xoá, hoặc bảng chưa từng tồn tại."
        backLabel={backLabel} onBack={() => navigate(backTo)} />
    );
  }

  if (status === 'forbidden') {
    return (
      <StatusCard icon="🔒" title="Bạn không có quyền xem bảng này"
        message="Bảng này thuộc một project khác với tài khoản của bạn."
        backLabel={backLabel} onBack={() => navigate(backTo)} />
    );
  }

  if (status === 'error') {
    return (
      <StatusCard icon="⚠️" title="Không tải được bảng tính giá"
        message="Kiểm tra kết nối mạng rồi thử lại."
        actionLabel="Thử lại" onAction={load}
        backLabel={backLabel} onBack={() => navigate(backTo)} />
    );
  }

  if (isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: PS.bgApp, color: PS.text }}>
        <AppToast toast={toast} onClose={() => setToast(null)} />
        <PriceSheetReadOnlyView
          sheet={sheet}
          footerNote="Chỉ xem — Admin không sửa hay xoá bảng tính giá của Seller ở đây."
          actions={<>
            <Btn variant="outline" onClick={() => setHistoryFor(sheet)}>Lịch sử phiên bản</Btn>
            <Btn variant="outline" onClick={handleCopyLink}>🔗 Copy link</Btn>
            <Btn variant="outline" onClick={() => exportSheetToExcel(sheet, showToast)}>⬇ Export Excel</Btn>
            <Btn variant="outline" onClick={() => navigate(backTo)}>← Quay lại</Btn>
          </>}
        />
        {historyFor && (
          <HistoryPanel
            sheet={historyFor}
            readOnly
            onClose={() => setHistoryFor(null)}
            onExportVersion={(snap) => exportSheetToExcel({ ...historyFor, name: `${historyFor.name}_v${snap.version}`, settings: snap.settings, productTypes: snap.productTypes }, showToast)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <AppToast toast={toast} onClose={() => setToast(null)} />
      <PriceSheetWorkspace sheet={sheet} onSave={handleSaveWorkspace} onClose={() => navigate(backTo)} showToast={showToast} />
    </>
  );
}
