import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import AdminDashboard from "./pages/AdminDashboard";
import SellerDashboard from "./pages/SellerDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import CsfDashboard from "./pages/CsfDashboard";
import MarvelVendorLibrary from "./components/csfpd/MarvelVendorLibrary";
import PdDashboard from "./pages/PdDashboard";
import PriceSheetPage from "./pages/PriceSheetPage";
import LibraryFilePage from "./pages/LibraryFilePage";

import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

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

  return (
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
            <LibraryFilePage />
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
  );
}