import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { rememberPostLoginRedirect } from "../utils/postLoginRedirect";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    rememberPostLoginRedirect(location.pathname);
    return <Navigate to="/" />;
  }

  return children;
}