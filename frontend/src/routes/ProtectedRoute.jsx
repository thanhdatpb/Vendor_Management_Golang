import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { rememberPostLoginRedirect } from "../utils/postLoginRedirect";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    // Truyền cả `location` (không chỉ pathname) để giữ luôn ?row= và #tab —
    // link trỏ tới một phôi cụ thể phải mở đúng phôi đó sau khi đăng nhập.
    rememberPostLoginRedirect(location);
    return <Navigate to="/" />;
  }

  return children;
}