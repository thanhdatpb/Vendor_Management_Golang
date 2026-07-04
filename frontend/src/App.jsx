import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import AdminDashboard from "./pages/AdminDashboard";
import SellerDashboard from "./pages/SellerDashboard";
import VendorDashboard from "./pages/VendorDashboard";
import CsfDashboard from "./pages/CsfDashboard";
import PdDashboard from "./pages/PdDashboard";

import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["admin"]}>
              <AdminDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/seller"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["staffa", "staff", "seller"]}>
              <SellerDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/vendor"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["staffb", "vendor"]}>
              <VendorDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/csf"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["csf"]}>
              <CsfDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pd"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["pd"]}>
              <PdDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}