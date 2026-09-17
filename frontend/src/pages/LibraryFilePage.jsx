// ════════════════════════════════════════════════════════
//  LIBRARY FILE PAGE — /library/:fileId
//
//  Màn hình người nhận link thấy khi mở từ Slack/email mà CHƯA có danh sách
//  thư viện nào đang mở. Cùng một cửa sổ với lúc bấm từ danh sách, chỉ khác là
//  nền phía sau trống (danh sách chưa mount) và nút đóng đưa về mục Thư Viện
//  Vendor của chính role đó.
//
//  Khi bấm từ trong danh sách thì KHÔNG đi qua trang này: App.jsx giữ dashboard
//  mount bằng `location.state.libraryBackground`, và VendorLibraryViewer /
//  VendorLibraryView tự dựng cửa sổ — nhờ vậy đóng ra không mất chỗ cuộn.
//
//  Nội dung lấy từ GET /api/vendor-library/files/{id}: server đã lọc sẵn giá
//  và AVG TG theo role, nên trang này không phải tự giấu cột.
// ════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vendorLibraryApi } from '../services/api';
import { HC } from '../constants/sellerTheme';
import { libraryPathForRole } from '../constants/dashboardSections';
import { canSeeLeadTime, canSeePrices } from '../constants/vendorFieldVisibility';
import LibraryFileModal from '../components/library/LibraryFileModal';
import LibraryCopyLinkButton from '../components/library/LibraryCopyLinkButton';
import { LibraryCard } from '../components/vendor/sections/VendorLibraryViewer';
import { MergedInfoTable } from '../components/csfpd/VendorLibraryView';
import {
  libraryFilePath,
  LIBRARY_BY_NAME,
} from '../utils/libraryFileLink';
import { fmtVNDateTimeShort } from '../utils/vnTime';

/** Card trạng thái lỗi (404 / 403 / mạng) — cùng khuôn với PriceSheetPage. */
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

const SHIMMER_CSS = `
  @keyframes hcLibShimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  .hc-lib-loading-bar {
    display: inline-block; vertical-align: middle; border-radius: 6px;
    background: linear-gradient(90deg, ${HC.orangeLight} 25%, ${HC.orangePale} 50%, ${HC.orangeLight} 75%);
    background-size: 200% 100%;
    animation: hcLibShimmer 1.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) { .hc-lib-loading-bar { animation: none; } }
`;

/** Thanh chữ giả — giữ chỗ cho tên file / dòng đếm khi file chưa tải xong. */
function LoadingBar({ width, height }) {
  return (
    <span
      aria-hidden="true"
      className="hc-lib-loading-bar"
      style={{ width, maxWidth: '100%', height }}
    />
  );
}

/** Khung nội dung giả: hàng tab mục + bảng, đúng bố cục cửa sổ sắp hiện. */
function FileBodySkeleton() {
  const columns = [1.2, 1, 2.4, 1, 1, 1.4];
  return (
    <div role="status" aria-label="Đang tải nội dung file">
      <style>{SHIMMER_CSS}</style>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <LoadingBar width={170} height={30} />
        <LoadingBar width={90} height={30} />
      </div>
      <div style={{
        border: `1px solid ${HC.border}`, borderRadius: 12, overflow: 'hidden',
        background: HC.surface,
      }}>
        {Array.from({ length: 9 }, (_, row) => (
          <div
            key={row}
            style={{
              display: 'grid', gap: 16, alignItems: 'center',
              gridTemplateColumns: columns.map((w) => `${w}fr`).join(' '),
              padding: row === 0 ? '12px 14px' : '14px',
              background: row === 0 ? HC.surface2 : HC.surface,
              borderTop: row === 0 ? 'none' : `1px solid ${HC.border}`,
            }}
          >
            {columns.map((_, col) => (
              <LoadingBar
                key={col}
                width={row === 0 ? '60%' : `${55 + ((row * 7 + col * 13) % 40)}%`}
                height={row === 0 ? 9 : 11}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LibraryFilePage({ initialFile = null }) {
  const { fileId, slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const role = typeof user?.role === 'object' ? user?.role?.name : user?.role;
  const backTo = libraryPathForRole(role);
  const backLabel = '← Về Thư viện Vendor';

  // Khi mở từ danh sách, file đã có sẵn trong dashboard. Dùng ngay snapshot đó để
  // cửa sổ xuất hiện trong cùng frame với lần click, thay vì phủ nền rồi chờ thêm
  // một request GET /files/:id. Mở thẳng permalink/F5 vẫn tải từ endpoint riêng.
  const matchingInitialFile = initialFile && String(initialFile.id) === String(fileId)
    ? initialFile
    : null;
  const [file, setFile] = useState(matchingInitialFile);
  const [status, setStatus] = useState(matchingInitialFile ? 'ready' : 'loading'); // loading | ready | not_found | forbidden | error

  // `/library/by-name/<tên file>`: link cũ trong mail chỉ mang tên file. Tra ra
  // id rồi viết lại URL sang dạng chuẩn bằng `replace` — không đẻ thêm một bước
  // lịch sử để nút Back khỏi quay về chính cái link cũ.
  const byName = fileId === LIBRARY_BY_NAME ? (slug || '') : null;

  const load = useCallback(async () => {
    if (matchingInitialFile && !byName) {
      setFile(matchingInitialFile);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    try {
      const res = byName
        ? await vendorLibraryApi.getFileByName(byName)
        : await vendorLibraryApi.getFile(fileId);

      if (byName && res.data?.id) {
        navigate(libraryFilePath(res.data.id, res.data.filename), { replace: true });
        return;
      }

      setFile(res.data);
      setStatus('ready');
    } catch (err) {
      const code = err?.response?.status;
      if (code === 404) setStatus('not_found');
      else if (code === 403) setStatus('forbidden');
      else {
        console.warn('Không tải được file thư viện:', err?.message || err);
        setStatus('error');
      }
    }
  }, [byName, fileId, matchingInitialFile, navigate]);

  useEffect(() => { load(); }, [load]);

  if (status === 'not_found') {
    return (
      <StatusCard icon="🔍" title="Không tìm thấy file này"
        message="Link có thể trỏ tới file đã bị xoá, hoặc file đã được import lại dưới tên khác."
        backLabel={backLabel} onBack={() => navigate(backTo)} />
    );
  }

  if (status === 'forbidden') {
    return (
      <StatusCard icon="🔒" title="Bạn không có quyền xem file này"
        message="File thuộc một project khác với tài khoản của bạn. Hỏi người gửi link xem bạn cần được chia sẻ project nào."
        backLabel={backLabel} onBack={() => navigate(backTo)} />
    );
  }

  if (status === 'error') {
    return (
      <StatusCard icon="⚠️" title="Không mở được file"
        message="Kiểm tra kết nối mạng rồi thử lại."
        actionLabel="Thử lại" onAction={load}
        backLabel={backLabel} onBack={() => navigate(backTo)} />
    );
  }

  const pageBackground = {
    minHeight: '100vh',
    background: `radial-gradient(ellipse at 60% 40%, ${HC.orangeMid} 0%, ${HC.cream} 45%, ${HC.orangePale} 100%)`,
  };
  const footer = 'Đóng cửa sổ để về Thư viện Vendor.';
  const closeFile = () => (matchingInitialFile ? navigate(-1) : navigate(backTo));

  // Mở thẳng từ link: không chen một màn "Đang mở file..." riêng trước cửa sổ.
  // Cửa sổ hiện ngay với khung nội dung giả, dữ liệu về thì điền vào ĐÚNG cửa
  // sổ đó — cùng vị trí trong cây nên không mount lại, không nháy animation.
  if (status === 'loading') {
    return (
      <div style={pageBackground}>
        <LibraryFileModal
          title={<LoadingBar width={180} height={14} />}
          ariaLabel="Đang mở file thư viện"
          subtitle={<LoadingBar width={150} height={10} />}
          footer={footer}
          onClose={closeFile}
        >
          <FileBodySkeleton />
        </LibraryFileModal>
      </div>
    );
  }

  const generalCount = file.counts?.generalInfo ?? file.generalInfo?.length ?? 0;
  const pricingCount = file.counts?.pricing ?? file.pricing?.length ?? 0;
  const vendorNames = [...new Set((file.generalInfo || [])
    .map((r) => (r.vendorName || r.kyHieu || '').trim())
    .filter(Boolean))];

  return (
    <div style={pageBackground}>
      <LibraryFileModal
        title={(file.filename || '').replace(/\.xlsx?$/i, '')}
        subtitle={`${generalCount} phôi · ${pricingCount} dòng giá · ${fmtVNDateTimeShort(file.importedAt)}`}
        badges={vendorNames.length > 0 && (
          <span style={{
            padding: '2px 8px', borderRadius: 99,
            background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`,
            color: HC.orangeDark, fontSize: 9.5, fontWeight: 800,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            {vendorNames.join(', ')}
          </span>
        )}
        actions={
          <LibraryCopyLinkButton
            file={file}
            onError={(err) => console.warn('Copy link file thư viện thất bại:', err?.message || err)}
          />
        }
        footer={footer}
        onClose={closeFile}
      >
        {canSeePrices(role) ? (
          // Role xem được giá: dùng lại đúng 2 tab của danh sách (Thông tin
          // chung về phôi / Về giá). Chỉ-đọc ở đây — sửa vẫn làm trong danh sách,
          // nơi có đủ luồng lưu và thông báo.
          <LibraryCard
            entry={file}
            embedded
            readOnly
            canShare={false}
            mode="all"
            bestSellerIds={new Set()}
            onUpdate={() => {}}
            onDelete={() => {}}
            toggleBestSeller={() => {}}
            onSampleStatusChange={() => {}}
          />
        ) : (
          // CSF/PD/Marvel: bảng gộp quen thuộc của họ. Server đã cắt cột giá,
          // nên ở đây không có gì để ẩn thêm.
          <MergedInfoTable
            generalInfo={file.generalInfo}
            pricing={file.pricing}
            showLeadTime={canSeeLeadTime(role)}
          />
        )}
      </LibraryFileModal>
    </div>
  );
}
