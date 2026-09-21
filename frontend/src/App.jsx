import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/Login";

import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

// ── Tách bundle theo route ───────────────────────────────────────────────────
// Trước đây mọi dashboard được import TĨNH, nên tất cả nằm chung một chunk
// `index-*.js` (~846 KB): người CSF tải cả màn hình Admin, Seller và Vendor —
// kể cả những component nặng mà role của họ không bao giờ mở tới.
//
// `Login` cố tình GIỮ import tĩnh: đó là màn hình đầu tiên của mọi phiên, tách
// nó ra chỉ thêm một vòng request trước khi thấy được gì.
//
// Mỗi role chỉ khớp đúng một route (RoleRoute chặn phần còn lại) nên trong một
// phiên thường chỉ có 1–2 chunk dưới đây được tải thật.
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard"));
const CsfDashboard = lazy(() => import("./pages/CsfDashboard"));
const PdDashboard = lazy(() => import("./pages/PdDashboard"));
const PriceSheetPage = lazy(() => import("./pages/PriceSheetPage"));
const LibraryFilePage = lazy(() => import("./pages/LibraryFilePage"));

// Marvel dùng CsfDashboard nhưng truyền component thư viện riêng qua PROP, nên
// nó phải là một component — bọc lazy ở đây và CsfDashboard render nó bên trong
// Suspense của App.
const MarvelVendorLibrary = lazy(() => import("./components/csfpd/MarvelVendorLibrary"));

/**
 * Màn hình chờ trong lúc chunk của route đang về.
 *
 * Cố ý TRỐNG chứ không phải spinner: chunk thường về trong vài chục ms trên
 * mạng bình thường, nhấp nháy một spinner rồi tắt ngay còn khó chịu hơn là
 * không có gì. Dashboard nào cũng đã có spinner riêng cho phần dữ liệu của nó.
 */
const RouteFallback = () => <div style={{ minHeight: "100vh" }} />;

export default function App() {
  const location = useLocation();
  // Mở một file thư viện TỪ DANH SÁCH đổi URL sang /library/:fileId nhưng phải
  // giữ nguyên dashboard phía sau: cửa sổ file phủ lên danh sách, đóng ra là
  // thấy đúng chỗ đang lướt và đúng bộ lọc. Muốn vậy thì `Routes` phải khớp
  // theo location CŨ (lưu trong state lúc điều hướng) chứ không theo URL mới —
  // nếu khớp theo URL mới thì dashboard unmount, tải lại cả thư viện, mất chỗ
  // cuộn. Cửa sổ do chính danh sách dựng (VendorLibraryViewer đọc URL thật).
  //
  // Mở THẲNG từ link dán vào Slack thì không có state này → khớp URL thật →
  // LibraryFilePage tự tải file và dựng cửa sổ trên nền trống.
  const libraryBackground = location.state?.libraryBackground;
  // Danh sách Admin/Vendor/Seller tự dựng modal bằng chính state và callback
  // đang có sẵn để giữ nguyên quyền sửa. Các view chỉ-đọc vẫn dùng route overlay.
  const libraryInline = location.state?.libraryInline === true;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes location={libraryBackground || location}>
      {/* :section? = mục đang mở trong dashboard (tab sidebar). Mỗi mục có URL
          riêng để bookmark / gửi link / F5 / Back đều đúng mục — trước đây cả
          role chỉ có một URL nên mọi lần remount đều rớt về mục mặc định.
          Thiếu hoặc sai slug thì useSectionRoute viết lại về mục mặc định.
          Danh sách slug: constants/dashboardSections.js */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route
        path="/admin/:section?"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin"]}>
              <AdminDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/seller/:section?"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["staffa", "staff", "seller"]}>
              <SellerDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/vendor/:section?"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["staffb", "vendor"]}>
              <VendorDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/csf/:section?"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["csf"]}>
              <CsfDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Marvel dùng chung dashboard với CSF (quyền y hệt), chỉ khác nhãn */}
      <Route
        path="/marvel/:section?"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["marvel"]}>
              <CsfDashboard basePath="/marvel" roleLabel="Marvel" libraryComponent={MarvelVendorLibrary} />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pd/:section?"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["pd"]}>
              <PdDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Link riêng cho 1 file Thư viện Vendor. Mở cho MỌI role đã đăng nhập:
          một link gửi cho ai cũng mở được, còn thấy gì (giá, AVG TG, phạm vi
          project) do server quyết định ở GET /vendor-library/files/{id} —
          không chặn theo role ở đây để khỏi trả 403 oan cho người có quyền xem.
          `:slug?` chỉ để link đọc được khi dán vào Slack, không dùng để tra cứu. */}
      <Route
        path="/library/:fileId/:slug?"
        element={
          <ProtectedRoute>
            <LibraryFilePage initialFile={location.state?.libraryFile} />
          </ProtectedRoute>
        }
      />

      {/* Link riêng cho 1 bảng tính giá — chỉ Admin + Seller/StaffA, không public,
          không cho CSF/PD/Marvel/StaffB/Vendor (bảng chứa giá bán). */}
      <Route
        path="/price-sheets/:id"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin", "seller", "staffa", "staff"]}>
              <PriceSheetPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      </Routes>

      {/* Khi mở từ danh sách, Routes phía trên cố ý dùng location nền để
          dashboard không unmount. Route overlay này phải dùng location thật,
          nếu không component danh sách chỉ thấy /vendor/library và URL file
          sẽ đổi nhưng cửa sổ không thể tự dựng. */}
      {libraryBackground && !libraryInline && (
        <Routes location={location}>
          <Route
            path="/library/:fileId/:slug?"
            element={
              <ProtectedRoute>
                <LibraryFilePage initialFile={location.state?.libraryFile} />
              </ProtectedRoute>
            }
          />
        </Routes>
      )}
    </Suspense>
  );
}
