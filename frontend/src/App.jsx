import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import AdminDashboard from "./pages/AdminDashboard";
import SellerDashboard from "./pages/SellerDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import CsfDashboard from "./pages/CsfDashboard";
import MarvelVendorLibrary from "./components/csfpd/MarvelVendorLibrary";
import PdDashboard from "./pages/PdDashboard";
import PriceSheetPage from "./pages/PriceSheetPage";

import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

export default function App() {
  return (
    <Routes>
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