import { Routes, Route, Navigate } from "react-router-dom"; // ✅ thêm Navigate

import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import StaffADashboard from "./pages/StaffADashboard";
import StaffBDashboard from "./pages/StaffBDashboard";

import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Navigate to="/" replace />} /> {/* ✅ thêm dòng này */}

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
        path="/staff-a"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["staffa"]}>
              <StaffADashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/staff-b"
        element={
          <ProtectedRoute>
            <RoleRoute allow={["staffb"]}>
              <StaffBDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}